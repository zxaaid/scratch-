// File System Access API Utility for direct PC/Tablet Local Storage & File/Folder Creation
import { Page, Notebook, ThemeId } from '../types';
import { generatePagePdfArrayBuffer, generateNotebookPdfArrayBuffer } from './exportUtils';

export interface LocalFileSystemState {
  dirHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  autoSaveEnabled: boolean;
  lastSavedAt: string | null;
  isSaving: boolean;
  error: string | null;
}

export interface LocalDirectoryItem {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
  path: string;
}

const DB_NAME = 'NotebookApp_FS_DB';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'local_root_dir_handle';

// 1. IndexedDB Helper to persist FileSystemDirectoryHandle across reloads
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Could not store directory handle in IndexedDB:', err);
  }
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function clearStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  } catch (err) {
    console.warn('Could not clear stored handle:', err);
  }
}

// 2. Permission Verification
export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true
): Promise<boolean> {
  try {
    const handleWithPerms = handle as unknown as {
      queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<string>;
      requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<string>;
    };

    const options = { mode: readWrite ? ('readwrite' as const) : ('read' as const) };

    if (handleWithPerms.queryPermission) {
      const status = await handleWithPerms.queryPermission(options);
      if (status === 'granted') return true;
    }
    if (handleWithPerms.requestPermission) {
      const status = await handleWithPerms.requestPermission(options);
      if (status === 'granted') return true;
    }
    return true; // Fallback if browser grants default access
  } catch (err) {
    console.warn('Permission check failed:', err);
    return true;
  }
}

// 3. User Pick Directory
export async function pickLocalDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  name: string;
} | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API is not supported in this browser. Please use Google Chrome, Edge, or an updated browser on your PC/Tablet.');
  }

  try {
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
      mode: 'readwrite',
      id: 'notebook_workspace_folder',
    });
    const hasPermission = await verifyDirectoryPermission(handle, true);
    if (!hasPermission) {
      throw new Error('Permission to write to the folder was denied.');
    }
    await storeDirectoryHandle(handle);
    return { handle, name: handle.name };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null; // User canceled picker
    }
    throw err;
  }
}

// 4. Create Folder Directly on Device
export async function createLocalSubfolder(
  parentHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> {
  const sanitized = folderName.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Untitled Folder';
  const subDir = await parentHandle.getDirectoryHandle(sanitized, { create: true });
  return subDir;
}

// 5. Create File Directly on Device
export async function createLocalFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string | Blob | ArrayBuffer
): Promise<FileSystemFileHandle> {
  const sanitized = fileName.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'untitled.txt';
  const fileHandle = await dirHandle.getFileHandle(sanitized, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return fileHandle;
}

// 6. Scan Local Directory to list existing files and folders
export async function scanLocalDirectory(
  dirHandle: FileSystemDirectoryHandle,
  maxDepth = 2,
  currentPath = ''
): Promise<LocalDirectoryItem[]> {
  const items: LocalDirectoryItem[] = [];
  try {
    const entries = (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
    for await (const entry of entries) {
      const itemPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      items.push({
        name: entry.name,
        kind: entry.kind as 'file' | 'directory',
        handle: entry,
        path: itemPath,
      });

      if (entry.kind === 'directory' && maxDepth > 1) {
        const subItems = await scanLocalDirectory(
          entry as FileSystemDirectoryHandle,
          maxDepth - 1,
          itemPath
        );
        items.push(...subItems);
      }
    }
  } catch (err) {
    console.warn('Error scanning local directory:', err);
  }
  return items;
}

// 7. Save Entire Workspace Directly to Local Folder as JSON and PDF documents
export async function saveWorkspaceToLocalFolder(
  rootHandle: FileSystemDirectoryHandle,
  workspaceData: object,
  currentTheme: ThemeId = 'vscode-dark'
): Promise<void> {
  // Save main workspace state file
  await createLocalFile(
    rootHandle,
    'workspace_notebooks.json',
    JSON.stringify(workspaceData, null, 2)
  );

  // Organize individual notebook folders on disk
  const ws = workspaceData as { notebooks?: Notebook[]; folders?: Array<{ title: string }> };

  if (ws.folders && Array.isArray(ws.folders)) {
    for (const folder of ws.folders) {
      try {
        await createLocalSubfolder(rootHandle, folder.title);
      } catch (e) {
        console.warn(`Could not create subfolder ${folder.title}:`, e);
      }
    }
  }

  if (ws.notebooks && Array.isArray(ws.notebooks)) {
    for (const nb of ws.notebooks) {
      try {
        const nbDirName = nb.title ? nb.title.replace(/[/\\?%*:|"<>]/g, '-').trim() : 'Untitled Notebook';
        const nbHandle = await createLocalSubfolder(rootHandle, nbDirName);
        await createLocalFile(nbHandle, 'notebook_data.json', JSON.stringify(nb, null, 2));

        // 1. Generate & Save full notebook as PDF directly to local disk
        const nbPdfBuffer = generateNotebookPdfArrayBuffer(nb, currentTheme);
        if (nbPdfBuffer) {
          await createLocalFile(nbHandle, `${nbDirName}.pdf`, nbPdfBuffer);
        }

        // 2. Generate & Save individual PDF files for each page in the notebook
        if (nb.pages && Array.isArray(nb.pages)) {
          for (const page of nb.pages) {
            const sanitizedPageTitle = (page.title || 'Page').replace(/[/\\?%*:|"<>]/g, '-').trim();
            const pagePdfBuffer = generatePagePdfArrayBuffer(page, currentTheme);
            await createLocalFile(nbHandle, `${sanitizedPageTitle}.pdf`, pagePdfBuffer);
            await createLocalFile(nbHandle, `${sanitizedPageTitle}.json`, JSON.stringify(page, null, 2));
          }
        }
      } catch (e) {
        console.warn(`Could not save notebook ${nb.title} to folder:`, e);
      }
    }
  }
}

// 8. Read and import file from local disk
export async function readLocalFileContent(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}
