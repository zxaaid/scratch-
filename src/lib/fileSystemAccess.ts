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

// 7. Save Entire Workspace directly to local folder with minimal file creation (workspace_notebooks.json + single PDF)
export async function saveWorkspaceToLocalFolder(
  rootHandle: FileSystemDirectoryHandle,
  workspaceData: object,
  currentTheme: ThemeId = 'vscode-dark'
): Promise<void> {
  // 1. Save single workspace state JSON file
  await createLocalFile(
    rootHandle,
    'workspace_notebooks.json',
    JSON.stringify(workspaceData, null, 2)
  );

  // 2. Save a single compiled PDF document for the primary active notebook (no extra subfolders or individual page files)
  const ws = workspaceData as { notebooks?: Notebook[] };
  if (ws.notebooks && Array.isArray(ws.notebooks) && ws.notebooks.length > 0) {
    const mainNotebook = ws.notebooks[0];
    const pdfBuffer = generateNotebookPdfArrayBuffer(mainNotebook, currentTheme);
    if (pdfBuffer) {
      const pdfFileName = mainNotebook.title
        ? `${mainNotebook.title.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`
        : 'notebook_notes.pdf';
      await createLocalFile(rootHandle, pdfFileName, pdfBuffer);
    }
  }
}

// 8. Read and import workspace from local disk folder
export async function loadWorkspaceFromLocalFolder(
  rootHandle: FileSystemDirectoryHandle
): Promise<object | null> {
  try {
    const fileHandle = await rootHandle.getFileHandle('workspace_notebooks.json');
    const content = await readLocalFileContent(fileHandle);
    if (content) {
      return JSON.parse(content);
    }
  } catch {
    return null;
  }
  return null;
}

// 9. Read file text content from handle
export async function readLocalFileContent(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}
