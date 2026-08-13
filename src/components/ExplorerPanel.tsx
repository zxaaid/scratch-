import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderPlus,
  BookPlus,
  FilePlus,
  Trash2,
  Edit2,
  Square,
  CheckSquare,
  Folder,
  FolderOpen,
  Book,
  FileText,
  Search,
  Tag,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Star,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { Workspace, Folder as FolderType, Notebook, Page, ThemeId } from '../types';
import { THEMES } from '../lib/themes';
import { downloadNotebookAsPdf, downloadPageAsPdf, downloadSelectedFiles } from '../lib/exportUtils';
import { LocalFileSystemState } from '../lib/fileSystemAccess';

interface ExplorerPanelProps {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  activePageId?: string;
  onSelectPage: (notebookId: string, pageId: string) => void;
  currentTheme: ThemeId;
  isShrunk?: boolean;
  onToggleShrink?: () => void;
  localFsState: LocalFileSystemState;
  onConnectLocalDirectory: () => void;
  onDisconnectLocalDirectory: () => void;
  onToggleAutoSave: () => void;
  onCreateLocalSubfolder: () => void;
  onCreateLocalFile: () => void;
  onSyncLocalDirectory: () => void;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  workspace,
  setWorkspace,
  activePageId,
  onSelectPage,
  currentTheme,
  isShrunk,
  onToggleShrink,
  localFsState,
  onConnectLocalDirectory,
  onDisconnectLocalDirectory,
  onSyncLocalDirectory,
}) => {
  const theme = THEMES[currentTheme];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDownloadSelected = () => {
    downloadSelectedFiles(workspace.notebooks, selectedItemIds, workspace.pdfs, currentTheme);
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.map((f) =>
        f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
      ),
    }));
  };

  // Add Folder
  const handleAddFolder = () => {
    const title = prompt('Enter new folder name:', 'New Folder');
    if (!title || !title.trim()) return;
    const newFolder: FolderType = {
      id: `f_${Date.now()}`,
      title: title.trim(),
      isExpanded: true,
    };
    setWorkspace((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
  };

  // Rename Folder
  const handleRenameFolder = (e: React.MouseEvent, folderId: string, currentTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename folder:', currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle === currentTitle) return;
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === folderId ? { ...f, title: newTitle.trim() } : f)),
    }));
  };

  // Delete Folder
  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this folder and its notebooks?')) return;
    setWorkspace((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== folderId),
      notebooks: prev.notebooks.filter((nb) => nb.folderId !== folderId),
    }));
  };

  // Add Notebook or Page (New File)
  const handleNewFile = (folderId?: string) => {
    const title = prompt('Enter file/notebook title:', 'Untitled Note');
    if (!title || !title.trim()) return;
    const newNotebook: Notebook = {
      id: `nb_${Date.now()}`,
      title: title.trim(),
      folderId,
      tags: ['Notes'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: `pg_${Date.now()}`,
          title: 'Page 1',
          template: 'ruled',
          strokes: [],
          shapes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    setWorkspace((prev) => ({
      ...prev,
      notebooks: [...prev.notebooks, newNotebook],
    }));
    onSelectPage(newNotebook.id, newNotebook.pages[0].id);
  };

  // Rename Notebook
  const handleRenameNotebook = (e: React.MouseEvent, notebookId: string, currentTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename notebook:', currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle === currentTitle) return;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) => (nb.id === notebookId ? { ...nb, title: newTitle.trim() } : nb)),
    }));
  };

  // Delete Notebook
  const handleDeleteNotebook = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this notebook?')) return;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.filter((nb) => nb.id !== notebookId),
    }));
  };

  // Add Page to Notebook
  const handleAddPage = (notebookId: string) => {
    const title = prompt('Enter new page title:', `Page ${Date.now().toString().slice(-3)}`);
    if (!title || !title.trim()) return;

    const newPage: Page = {
      id: `pg_${Date.now()}`,
      title: title.trim(),
      template: 'ruled',
      strokes: [],
      shapes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) =>
        nb.id === notebookId
          ? { ...nb, pages: [...nb.pages, newPage], updatedAt: new Date().toISOString() }
          : nb
      ),
    }));
    onSelectPage(notebookId, newPage.id);
  };

  // Rename Page
  const handleRenamePage = (e: React.MouseEvent, notebookId: string, pageId: string, currentTitle: string) => {
    e.stopPropagation();
    const newTitle = prompt('Rename page:', currentTitle);
    if (!newTitle || !newTitle.trim() || newTitle === currentTitle) return;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) => {
        if (nb.id !== notebookId) return nb;
        return {
          ...nb,
          pages: nb.pages.map((pg) => (pg.id === pageId ? { ...pg, title: newTitle.trim() } : pg)),
        };
      }),
    }));
  };

  // Delete Page
  const handleDeletePage = (e: React.MouseEvent, notebookId: string, pageId: string) => {
    e.stopPropagation();
    const notebook = workspace.notebooks.find((nb) => nb.id === notebookId);
    if (!notebook) return;
    if (notebook.pages.length <= 1) {
      alert('A notebook must contain at least one page.');
      return;
    }
    if (!confirm('Are you sure you want to delete this page?')) return;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) => {
        if (nb.id !== notebookId) return nb;
        return {
          ...nb,
          pages: nb.pages.filter((pg) => pg.id !== pageId),
        };
      }),
    }));
  };

  // Toggle Favorite
  const handleToggleFavorite = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) =>
        nb.id === notebookId ? { ...nb, isFavorite: !nb.isFavorite } : nb
      ),
    }));
  };

  // All distinct tags across notebooks
  const allTags = Array.from(
    new Set(workspace.notebooks.flatMap((nb) => nb.tags || []))
  );

  return (
    <div
      className="w-full h-full flex flex-col select-none border-r text-xs overflow-hidden"
      style={{
        backgroundColor: theme.sidebarBg,
        color: theme.sidebarFg,
        borderColor: theme.border,
      }}
    >
      {/* Clean VS Code-style Header Bar */}
      <div
        className="px-3 py-2 font-bold tracking-wider uppercase flex items-center justify-between border-b"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          borderColor: theme.border,
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{isShrunk ? 'Exp.' : 'Explorer'}</span>
          {localFsState.dirHandle && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-normal bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate"
              title={`Linked to local disk: ${localFsState.folderName}`}
            >
              /{localFsState.folderName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleNewFile()}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="New File / Notebook"
          >
            <FilePlus size={15} />
          </button>
          <button
            onClick={handleAddFolder}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="New Folder"
          >
            <FolderPlus size={15} />
          </button>
          <button
            onClick={onConnectLocalDirectory}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-sky-300 transition-colors"
            title={localFsState.dirHandle ? `Open/Switch Local Folder (Current: ${localFsState.folderName})` : 'Open Local Folder'}
          >
            <FolderOpen size={15} />
          </button>
          {localFsState.dirHandle && (
            <button
              onClick={onSyncLocalDirectory}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-emerald-300 transition-colors"
              title="Sync Workspace with Local Folder"
            >
              <RefreshCw size={14} className={localFsState.isSaving ? 'animate-spin text-emerald-400' : ''} />
            </button>
          )}
          {onToggleShrink && (
            <button
              onClick={onToggleShrink}
              className="p-1 rounded hover:bg-white/10 text-sky-400 hover:text-sky-300 ml-1 transition-colors"
              title={isShrunk ? 'Expand Explorer Panel' : 'Shrink Explorer Panel'}
            >
              {isShrunk ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Search & Selection Bar */}
      <div className="p-2 border-b flex flex-col gap-1.5" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-white/10">
          <Search size={13} className="text-gray-400" />
          <input
            type="text"
            placeholder="Filter notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-white placeholder-gray-500"
          />
        </div>

        {selectedItemIds.length > 0 ? (
          <button
            onClick={handleDownloadSelected}
            className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center gap-1.5 shadow transition-all text-xs cursor-pointer"
          >
            <Download size={13} />
            <span>Download Selected ({selectedItemIds.length})</span>
          </button>
        ) : (
          <button
            onClick={() => {
              if (workspace.notebooks.length > 0) {
                downloadNotebookAsPdf(workspace.notebooks[0], currentTheme);
              }
            }}
            className="w-full py-1 px-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded flex items-center justify-center gap-1.5 transition-all text-[11px] cursor-pointer border border-white/10"
            title="Download active notebook as PDF"
          >
            <Download size={12} className="text-emerald-400" />
            <span>Download Current File</span>
          </button>
        )}
      </div>

      {/* Tag Filter Strip */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto border-b" style={{ borderColor: theme.border }}>
          <Tag size={12} className="text-gray-400 shrink-0" />
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
              selectedTag === null ? 'bg-sky-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                selectedTag === tag ? 'bg-sky-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Workspace Folders & Notebooks List */}
      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {/* Workspace Root Header */}
        <div className="px-2 py-1 font-semibold text-gray-400 uppercase text-[10px] tracking-wider flex items-center justify-between">
          <span className="truncate">{workspace.name}</span>
          {localFsState.dirHandle && (
            <button
              onClick={onDisconnectLocalDirectory}
              className="text-[9px] text-gray-400 hover:text-red-400 lowercase normal-case underline"
              title="Unlink local folder"
            >
              unlink
            </button>
          )}
        </div>

        {/* Empty State when all files and folders are deleted */}
        {workspace.folders.length === 0 && workspace.notebooks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-4 text-center my-6 space-y-3 bg-black/10 rounded-lg border border-dashed border-white/10 mx-1">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-full">
              <FolderOpen size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200">No Open Files or Folders</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-[200px]">
                You have no active files or folders in your explorer.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
              <button
                onClick={onConnectLocalDirectory}
                className="w-full py-2 px-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer border border-sky-400/30"
                title="Redirects to system File Explorer where you can create a folder or select an existing one"
              >
                <FolderOpen size={14} />
                <span>Open / Create Folder</span>
              </button>
              <button
                onClick={handleAddFolder}
                className="w-full py-1.5 px-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Create a new folder in workspace"
              >
                <FolderPlus size={14} className="text-amber-400" />
                <span>New Folder</span>
              </button>
              <button
                onClick={() => handleNewFile()}
                className="w-full py-1.5 px-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                title="Create a new file / notebook"
              >
                <FilePlus size={14} className="text-sky-400" />
                <span>New File</span>
              </button>
            </div>
          </div>
        )}

        {/* Folders */}
        {workspace.folders.map((folder) => {
          const folderNotebooks = workspace.notebooks.filter(
            (nb) => nb.folderId === folder.id
          ).filter((nb) => {
            if (searchQuery && !nb.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (selectedTag && !nb.tags.includes(selectedTag)) return false;
            return true;
          });

          return (
            <div key={folder.id} className="space-y-0.5">
              {/* Folder Line */}
              <div
                onClick={() => toggleFolder(folder.id)}
                className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-white/5 group"
                style={{ backgroundColor: folder.isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent' }}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {folder.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {folder.isExpanded ? (
                    <FolderOpen size={14} className="text-amber-400 shrink-0" />
                  ) : (
                    <Folder size={14} className="text-amber-400 shrink-0" />
                  )}
                  <span className="font-medium truncate">{folder.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewFile(folder.id);
                    }}
                    className="p-0.5 hover:text-sky-400 text-gray-400"
                    title="Add File/Notebook to Folder"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={(e) => handleRenameFolder(e, folder.id, folder.title)}
                    className="p-0.5 hover:text-amber-400 text-gray-400"
                    title="Rename Folder"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                    className="p-0.5 hover:text-rose-400 text-gray-400"
                    title="Delete Folder"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Notebooks inside Folder */}
              {folder.isExpanded && (
                <div className="pl-4 space-y-0.5">
                  {folderNotebooks.map((nb) => (
                    <NotebookTreeItem
                      key={nb.id}
                      notebook={nb}
                      activePageId={activePageId}
                      onSelectPage={onSelectPage}
                      onAddPage={handleAddPage}
                      onRenameNotebook={handleRenameNotebook}
                      onDeleteNotebook={handleDeleteNotebook}
                      onRenamePage={handleRenamePage}
                      onDeletePage={handleDeletePage}
                      onToggleFavorite={handleToggleFavorite}
                      theme={theme}
                      currentTheme={currentTheme}
                      selectedItemIds={selectedItemIds}
                      onToggleSelect={toggleSelectItem}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Level Notebooks (no folder) */}
        {workspace.notebooks
          .filter((nb) => !nb.folderId)
          .filter((nb) => {
            if (searchQuery && !nb.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (selectedTag && !nb.tags.includes(selectedTag)) return false;
            return true;
          })
          .map((nb) => (
            <NotebookTreeItem
              key={nb.id}
              notebook={nb}
              activePageId={activePageId}
              onSelectPage={onSelectPage}
              onAddPage={handleAddPage}
              onRenameNotebook={handleRenameNotebook}
              onDeleteNotebook={handleDeleteNotebook}
              onRenamePage={handleRenamePage}
              onDeletePage={handleDeletePage}
              onToggleFavorite={handleToggleFavorite}
              theme={theme}
              currentTheme={currentTheme}
              selectedItemIds={selectedItemIds}
              onToggleSelect={toggleSelectItem}
            />
          ))}
      </div>
    </div>
  );
};

interface NotebookTreeItemProps {
  notebook: Notebook;
  activePageId?: string;
  onSelectPage: (notebookId: string, pageId: string) => void;
  onAddPage: (notebookId: string) => void;
  onRenameNotebook: (e: React.MouseEvent, id: string, title: string) => void;
  onDeleteNotebook: (e: React.MouseEvent, id: string) => void;
  onRenamePage: (e: React.MouseEvent, notebookId: string, pageId: string, title: string) => void;
  onDeletePage: (e: React.MouseEvent, notebookId: string, pageId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  theme: any;
  currentTheme: ThemeId;
  selectedItemIds: string[];
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
}

const NotebookTreeItem: React.FC<NotebookTreeItemProps> = ({
  notebook,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenameNotebook,
  onDeleteNotebook,
  onRenamePage,
  onDeletePage,
  onToggleFavorite,
  theme,
  currentTheme,
  selectedItemIds,
  onToggleSelect,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isNotebookSelected = selectedItemIds.includes(notebook.id);

  return (
    <div className="space-y-0.5">
      {/* Notebook Line */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-white/5 group"
      >
        <div className="flex items-center gap-1.5 truncate">
          <button
            onClick={(e) => onToggleSelect(notebook.id, e)}
            className="text-gray-400 hover:text-sky-400 p-0.5"
            title="Select notebook to download"
          >
            {isNotebookSelected ? (
              <CheckSquare size={13} className="text-sky-400" />
            ) : (
              <Square size={13} className="text-gray-500" />
            )}
          </button>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Book size={14} className="text-sky-400 shrink-0" />
          <span className="font-medium truncate">{notebook.title}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadNotebookAsPdf(notebook, currentTheme);
            }}
            className="p-0.5 text-gray-400 hover:text-emerald-400"
            title="Download Notebook as PDF"
          >
            <Download size={12} />
          </button>
          <button
            onClick={(e) => onToggleFavorite(e, notebook.id)}
            className={`p-0.5 ${notebook.isFavorite ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400'}`}
            title="Toggle Favorite"
          >
            <Star size={12} fill={notebook.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPage(notebook.id);
            }}
            className="p-0.5 text-gray-400 hover:text-emerald-400"
            title="Add Page"
          >
            <FilePlus size={12} />
          </button>
          <button
            onClick={(e) => onRenameNotebook(e, notebook.id, notebook.title)}
            className="p-0.5 text-gray-400 hover:text-amber-400"
            title="Rename Notebook"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={(e) => onDeleteNotebook(e, notebook.id)}
            className="p-0.5 text-gray-400 hover:text-rose-400"
            title="Delete Notebook"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Pages inside Notebook */}
      {isOpen && (
        <div className="pl-4 space-y-0.5 border-l border-white/5 ml-2">
          {notebook.pages.map((page) => {
            const isActive = activePageId === page.id;
            const isPageSelected = selectedItemIds.includes(page.id);
            return (
              <div
                key={page.id}
                onClick={() => onSelectPage(notebook.id, page.id)}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors group/page ${
                  isActive ? 'bg-sky-600/30 text-sky-200 font-semibold border-l-2 border-sky-400' : 'hover:bg-white/5 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <button
                    onClick={(e) => onToggleSelect(page.id, e)}
                    className="text-gray-400 hover:text-sky-400 p-0.5"
                    title="Select page to download"
                  >
                    {isPageSelected ? (
                      <CheckSquare size={12} className="text-sky-400" />
                    ) : (
                      <Square size={12} className="text-gray-600" />
                    )}
                  </button>
                  <FileText size={13} className={isActive ? 'text-sky-400' : 'text-gray-500'} />
                  <span className="truncate">{page.title}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/page:opacity-100">
                  <button
                    onClick={(e) => onRenamePage(e, notebook.id, page.id, page.title)}
                    className="p-0.5 text-gray-400 hover:text-amber-400"
                    title="Rename Page"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={(e) => onDeletePage(e, notebook.id, page.id)}
                    className="p-0.5 text-gray-400 hover:text-rose-400"
                    title="Delete Page"
                  >
                    <Trash2 size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPageAsPdf(page, notebook.title, currentTheme);
                    }}
                    className="p-0.5 text-gray-400 hover:text-emerald-400"
                    title="Download Page PDF"
                  >
                    <Download size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

