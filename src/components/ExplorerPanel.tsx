import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderPlus,
  BookPlus,
  FilePlus,
  Trash2,
  Edit2,
  Copy,
  Star,
  Folder,
  FolderOpen,
  Book,
  FileText,
  Search,
  Tag,
  Plus,
} from 'lucide-react';
import { Workspace, Folder as FolderType, Notebook, Page, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface ExplorerPanelProps {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  activePageId?: string;
  onSelectPage: (notebookId: string, pageId: string) => void;
  currentTheme: ThemeId;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  workspace,
  setWorkspace,
  activePageId,
  onSelectPage,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
    const title = prompt('Enter new folder name:', 'New Subject Folder');
    if (!title) return;
    const newFolder: FolderType = {
      id: `f_${Date.now()}`,
      title,
      isExpanded: true,
    };
    setWorkspace((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
  };

  // Add Notebook
  const handleAddNotebook = (folderId?: string) => {
    const title = prompt('Enter new notebook title:', 'Untitled Notebook');
    if (!title) return;
    const newNotebook: Notebook = {
      id: `nb_${Date.now()}`,
      title,
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

  // Add Page to Notebook
  const handleAddPage = (notebookId: string) => {
    const title = prompt('Enter new page title:', `Page ${Date.now().toString().slice(-3)}`);
    if (!title) return;

    const newPage: Page = {
      id: `pg_${Date.now()}`,
      title,
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

  // Delete Notebook
  const handleDeleteNotebook = (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this notebook?')) return;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.filter((nb) => nb.id !== notebookId),
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
      className="w-64 h-full flex flex-col select-none border-r text-xs overflow-hidden"
      style={{
        backgroundColor: theme.sidebarBg,
        color: theme.sidebarFg,
        borderColor: theme.border,
      }}
    >
      {/* Header Bar */}
      <div
        className="px-3 py-2.5 font-bold tracking-wider uppercase flex items-center justify-between border-b"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          borderColor: theme.border,
        }}
      >
        <span>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddFolder}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="New Folder"
          >
            <FolderPlus size={15} />
          </button>
          <button
            onClick={() => handleAddNotebook()}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="New Notebook"
          >
            <BookPlus size={15} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b" style={{ borderColor: theme.border }}>
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
        <div className="px-2 py-1 font-semibold text-gray-400 uppercase text-[10px] tracking-wider">
          {workspace.name}
        </div>

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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddNotebook(folder.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-400 text-gray-400"
                  title="Add Notebook to Folder"
                >
                  <Plus size={13} />
                </button>
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
                      onDeleteNotebook={handleDeleteNotebook}
                      onToggleFavorite={handleToggleFavorite}
                      theme={theme}
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
              onDeleteNotebook={handleDeleteNotebook}
              onToggleFavorite={handleToggleFavorite}
              theme={theme}
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
  onDeleteNotebook: (e: React.MouseEvent, id: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  theme: any;
}

const NotebookTreeItem: React.FC<NotebookTreeItemProps> = ({
  notebook,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeleteNotebook,
  onToggleFavorite,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-0.5">
      {/* Notebook Line */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-white/5 group"
      >
        <div className="flex items-center gap-1.5 truncate">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Book size={14} className="text-sky-400 shrink-0" />
          <span className="font-medium truncate">{notebook.title}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
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
            return (
              <div
                key={page.id}
                onClick={() => onSelectPage(notebook.id, page.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors ${
                  isActive ? 'bg-sky-600/30 text-sky-200 font-semibold border-l-2 border-sky-400' : 'hover:bg-white/5 text-gray-300'
                }`}
              >
                <FileText size={13} className={isActive ? 'text-sky-400' : 'text-gray-500'} />
                <span className="truncate">{page.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
