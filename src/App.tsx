import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import {
  Workspace,
  TabItem,
  ActivityTab,
  PenToolType,
  ShapeType,
  HandwritingMode,
  PageTemplate,
  ThemeId,
  TabletSettings,
  PenPreset,
  Stroke,
  ShapeElement,
  ImageElement,
  Page,
  PDFItem,
  CommandPaletteAction,
  PracticeTemplate,
  HandwritingFeedback,
  PageAspectRatio,
} from './types';
import { INITIAL_WORKSPACE, INITIAL_PEN_PRESETS, INITIAL_TABLET_SETTINGS } from './data/initialWorkspace';
import { PRACTICE_TEMPLATES } from './data/practiceTemplates';
import { ActivityBar } from './components/ActivityBar';
import { ExplorerPanel } from './components/ExplorerPanel';
import { PracticePanel } from './components/PracticePanel';
import { PdfPanel } from './components/PdfPanel';
import { SearchPanel } from './components/SearchPanel';
import { AiPanel } from './components/AiPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { TabBar } from './components/TabBar';
import { PenToolbar } from './components/PenToolbar';
import { CanvasEditor } from './components/CanvasEditor';
import { BottomPageToolbar } from './components/BottomPageToolbar';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { AiDiffModal } from './components/AiDiffModal';
import { THEMES } from './lib/themes';
import { convertToElegantScript } from './lib/handwritingEngine';
import {
  LocalFileSystemState,
  pickLocalDirectory,
  getStoredDirectoryHandle,
  clearStoredDirectoryHandle,
  verifyDirectoryPermission,
  createLocalSubfolder,
  createLocalFile,
  saveWorkspaceToLocalFolder,
  loadWorkspaceFromLocalFolder,
} from './lib/fileSystemAccess';

const LS_WORKSPACE_KEY = 'notebook_app_workspace_v2';
const LS_TABS_KEY = 'notebook_app_tabs_v2';
const LS_ACTIVE_TAB_KEY = 'notebook_app_active_tab_v2';
const LS_THEME_KEY = 'notebook_app_theme_v2';

export default function App() {
  // Primary Workspace State with LocalStorage auto-restore across sessions
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      const saved = localStorage.getItem(LS_WORKSPACE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.notebooks)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not restore workspace from localStorage:', e);
    }
    return INITIAL_WORKSPACE;
  });

  const [currentTheme, setTheme] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(LS_THEME_KEY);
      if (saved && THEMES[saved as ThemeId]) {
        return saved as ThemeId;
      }
    } catch (e) {}
    return 'vscode-dark';
  });

  // Local File System Access State (Direct PC/Tablet Folder Storage)
  const [localFsState, setLocalFsState] = useState<LocalFileSystemState>({
    dirHandle: null,
    folderName: null,
    autoSaveEnabled: true,
    lastSavedAt: null,
    isSaving: false,
    error: null,
  });

  // Restore linked local folder handle on app mount
  useEffect(() => {
    async function restoreLocalFolder() {
      try {
        const storedHandle = await getStoredDirectoryHandle();
        if (storedHandle) {
          setLocalFsState((prev) => ({
            ...prev,
            dirHandle: storedHandle,
            folderName: storedHandle.name,
          }));

          // Try auto-loading workspace directly from disk folder if permission is active
          try {
            const diskWk = await loadWorkspaceFromLocalFolder(storedHandle);
            if (diskWk && (diskWk as any).notebooks) {
              setWorkspace(diskWk as Workspace);
            }
          } catch (err) {
            console.warn('Disk workspace auto-read deferred:', err);
          }
        }
      } catch (e) {
        console.warn('Error restoring local directory handle:', e);
      }
    }
    restoreLocalFolder();
  }, []);

  // Auto-persist app state to browser localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(LS_WORKSPACE_KEY, JSON.stringify(workspace));
    } catch (e) {
      console.warn('Could not save workspace to localStorage:', e);
    }
  }, [workspace]);

  // Sidebar & Navigation
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const isDraggingSidebarRef = useRef<boolean>(false);

  // Auto Tablet responsiveness on initial load & window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false); // Collapsed by default on small mobile screens
      } else if (window.innerWidth < 1024) {
        setSidebarWidth(140); // Compact view on tablets for maximum canvas space
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDraggingSidebarRef.current = true;
    setIsDraggingSidebar(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (clientX: number) => {
      if (!isDraggingSidebarRef.current) return;
      // ActivityBar width is 48px
      const rawWidth = clientX - 48;
      // Smooth fluid drag between 80px and 650px without collapsing automatically
      const newWidth = Math.max(80, Math.min(650, rawWidth));
      setSidebarWidth(newWidth);
    };

    const onMouseMove = (moveEvent: MouseEvent) => handleMove(moveEvent.clientX);
    const onTouchMove = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length > 0) {
        handleMove(touchEvent.touches[0].clientX);
      }
    };

    const handleUp = () => {
      isDraggingSidebarRef.current = false;
      setIsDraggingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', handleUp);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleToggleSidebarShrink = useCallback(() => {
    setSidebarWidth((prev) => (prev <= 160 ? 260 : 130));
  }, []);

  // Tabs State with LocalStorage restore
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    try {
      const saved = localStorage.getItem(LS_TABS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'tab_schrodinger',
        type: 'page',
        notebookId: 'nb_quantum',
        pageId: 'pg_schrodinger',
        title: '1. Schrödinger Equation',
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LS_ACTIVE_TAB_KEY);
      if (saved) return saved;
    } catch (e) {}
    return 'tab_schrodinger';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_TABS_KEY, JSON.stringify(tabs));
    } catch (e) {}
  }, [tabs]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_ACTIVE_TAB_KEY, activeTabId);
    } catch (e) {}
  }, [activeTabId]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_THEME_KEY, currentTheme);
    } catch (e) {}
  }, [currentTheme]);

  // Pen Tools & Drawing Settings
  const [currentTool, setCurrentTool] = useState<PenToolType>('fountain');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [color, setColor] = useState<string>('#1a1a2e');
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [handwritingMode, setHandwritingMode] = useState<HandwritingMode>(1);
  const [defaultTemplate, setDefaultTemplate] = useState<PageTemplate>('ruled');
  const [pageAspectRatio, setPageAspectRatio] = useState<PageAspectRatio>('a4-landscape');
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [penPresets, setPenPresets] = useState<PenPreset[]>(INITIAL_PEN_PRESETS);
  const [tabletSettings, setTabletSettings] = useState<TabletSettings>(INITIAL_TABLET_SETTINGS);

  // Practice Reference Guides & Handwriting Feedback State
  const [activeTemplate, setActiveTemplate] = useState<PracticeTemplate | null>(PRACTICE_TEMPLATES[0]);
  const [showTemplateOverlay, setShowTemplateOverlay] = useState<boolean>(false);
  const [handwritingFeedback, setHandwritingFeedback] = useState<HandwritingFeedback | null>(null);

  // Tablet Monitoring State
  const [tabletPressure, setTabletPressure] = useState<number>(0.5);
  const [tabletConnected, setTabletConnected] = useState<boolean>(true);

  // Local Device Storage (Direct Access) Handlers
  const handleConnectLocalDirectory = async () => {
    try {
      const res = await pickLocalDirectory();
      if (res) {
        setLocalFsState({
          dirHandle: res.handle,
          folderName: res.name,
          autoSaveEnabled: true,
          lastSavedAt: new Date().toLocaleTimeString(),
          isSaving: true,
          error: null,
        });

        // If workspace is empty, populate a folder and notebook for the linked directory
        let currentWk = workspace;
        if (workspace.folders.length === 0 && workspace.notebooks.length === 0) {
          const newFolder = {
            id: `f_${Date.now()}`,
            title: res.name || 'My Local Folder',
            isExpanded: true,
          };
          const newNotebook = {
            id: `nb_${Date.now()}`,
            title: `${res.name || 'Notes'} Overview`,
            folderId: newFolder.id,
            tags: ['Notes'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pages: [
              {
                id: `pg_${Date.now()}`,
                title: 'Page 1',
                template: 'ruled' as const,
                strokes: [],
                shapes: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          };
          currentWk = {
            ...workspace,
            folders: [newFolder],
            notebooks: [newNotebook],
          };
          setWorkspace(currentWk);
          handleSelectPage(newNotebook.id, newNotebook.pages[0].id);
        }

        await saveWorkspaceToLocalFolder(res.handle, currentWk);
        setLocalFsState((prev) => ({
          ...prev,
          isSaving: false,
          lastSavedAt: new Date().toLocaleTimeString(),
        }));
      }
    } catch (err) {
      alert(`Could not link local folder: ${(err as Error).message}`);
      setLocalFsState((prev) => ({ ...prev, isSaving: false, error: (err as Error).message }));
    }
  };

  const handleDisconnectLocalDirectory = async () => {
    await clearStoredDirectoryHandle();
    setLocalFsState({
      dirHandle: null,
      folderName: null,
      autoSaveEnabled: false,
      lastSavedAt: null,
      isSaving: false,
      error: null,
    });
  };

  const handleToggleAutoSave = () => {
    setLocalFsState((prev) => ({
      ...prev,
      autoSaveEnabled: !prev.autoSaveEnabled,
    }));
  };

  const handleCreateLocalSubfolder = async () => {
    if (!localFsState.dirHandle) {
      await handleConnectLocalDirectory();
      return;
    }
    const folderName = prompt('Enter subfolder name to create directly on your PC/Tablet:', 'Subject Notes');
    if (!folderName) return;
    try {
      const hasPerm = await verifyDirectoryPermission(localFsState.dirHandle, true);
      if (!hasPerm) {
        alert('Permission to write to local folder was denied.');
        return;
      }
      await createLocalSubfolder(localFsState.dirHandle, folderName);
      setWorkspace((prev) => ({
        ...prev,
        folders: [...prev.folders, { id: `f_${Date.now()}`, title: folderName, isExpanded: true }],
      }));
    } catch (err) {
      alert(`Error creating local folder: ${(err as Error).message}`);
    }
  };

  const handleCreateLocalFile = async () => {
    if (!localFsState.dirHandle) {
      await handleConnectLocalDirectory();
      return;
    }
    const fileName = prompt('Enter file name to create directly on your PC/Tablet (e.g. MyNotes.json):', 'Note.json');
    if (!fileName) return;
    try {
      const hasPerm = await verifyDirectoryPermission(localFsState.dirHandle, true);
      if (!hasPerm) {
        alert('Permission to write to local folder was denied.');
        return;
      }
      await createLocalFile(localFsState.dirHandle, fileName, JSON.stringify(workspace, null, 2));
      alert(`File "${fileName}" saved directly to your device storage!`);
    } catch (err) {
      alert(`Error creating local file: ${(err as Error).message}`);
    }
  };

  const handleSyncLocalDirectory = async () => {
    if (!localFsState.dirHandle) return;
    try {
      setLocalFsState((prev) => ({ ...prev, isSaving: true }));
      const hasPerm = await verifyDirectoryPermission(localFsState.dirHandle, true);
      if (hasPerm) {
        await saveWorkspaceToLocalFolder(localFsState.dirHandle, workspace);
        setLocalFsState((prev) => ({
          ...prev,
          isSaving: false,
          lastSavedAt: new Date().toLocaleTimeString(),
          error: null,
        }));
      } else {
        setLocalFsState((prev) => ({ ...prev, isSaving: false, error: 'Permission required' }));
      }
    } catch (err) {
      setLocalFsState((prev) => ({ ...prev, isSaving: false, error: (err as Error).message }));
    }
  };

  // Real-time Debounced Auto-Save to Local PC/Tablet Folder
  useEffect(() => {
    if (!localFsState.dirHandle || !localFsState.autoSaveEnabled) return;

    const timer = setTimeout(async () => {
      try {
        setLocalFsState((prev) => ({ ...prev, isSaving: true }));
        await saveWorkspaceToLocalFolder(localFsState.dirHandle!, workspace);
        setLocalFsState((prev) => ({
          ...prev,
          isSaving: false,
          lastSavedAt: new Date().toLocaleTimeString(),
          error: null,
        }));
      } catch (err) {
        console.warn('Auto-save to local folder error:', err);
        setLocalFsState((prev) => ({ ...prev, isSaving: false, error: 'Auto-save failed' }));
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [workspace, localFsState.dirHandle, localFsState.autoSaveEnabled]);

  // Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // AI Modal State
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiStatusText, setAiStatusText] = useState<string>('');
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiModalData, setAiModalData] = useState<{
    title: string;
    original: string;
    aiResult: string;
    actionType: string;
  }>({ title: '', original: '', aiResult: '', actionType: '' });

  // History Stack for Undo / Redo
  const [undoStack, setUndoStack] = useState<{ strokes: Stroke[]; shapes: ShapeElement[]; images?: ImageElement[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ strokes: Stroke[]; shapes: ShapeElement[]; images?: ImageElement[] }[]>([]);

  // Get Current Active Page or PDF
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeNotebook = workspace.notebooks.find((nb) => nb.id === activeTab?.notebookId);
  const activePage = activeNotebook?.pages.find((p) => p.id === activeTab?.pageId);
  const activePdf = workspace.pdfs.find((p) => p.id === activeTab?.pdfId);

  // Tab Selection Helper
  const handleSelectPage = (notebookId: string, pageId: string) => {
    const nb = workspace.notebooks.find((n) => n.id === notebookId);
    const pg = nb?.pages.find((p) => p.id === pageId);
    if (!pg) return;

    const existingTab = tabs.find((t) => t.pageId === pageId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: TabItem = {
        id: `tab_${Date.now()}`,
        type: 'page',
        notebookId,
        pageId,
        title: pg.title,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleSelectPdf = (pdfId: string) => {
    const pdf = workspace.pdfs.find((p) => p.id === pdfId);
    if (!pdf) return;

    const existingTab = tabs.find((t) => t.pdfId === pdfId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: TabItem = {
        id: `tab_pdf_${Date.now()}`,
        type: 'pdf',
        pdfId,
        title: pdf.name,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleCloseTab = (tabId: string) => {
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId && remaining.length > 0) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleNewBlankPage = () => {
    let targetNb = activeNotebook || workspace.notebooks[0];
    if (!targetNb) return;

    const newPage: Page = {
      id: `pg_${Date.now()}`,
      title: `Untitled Page ${targetNb.pages.length + 1}`,
      template: defaultTemplate,
      strokes: [],
      shapes: [],
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) =>
        nb.id === targetNb.id ? { ...nb, pages: [...nb.pages, newPage] } : nb
      ),
    }));

    handleSelectPage(targetNb.id, newPage.id);
  };

  // Canvas Stroke & Image Updates
  const handleUpdatePageStrokes = (
    pageId: string,
    newStrokes: Stroke[],
    newShapes: ShapeElement[],
    newImages?: ImageElement[]
  ) => {
    if (activePage) {
      setUndoStack((prev) => [
        ...prev.slice(-49),
        {
          strokes: activePage.strokes || [],
          shapes: activePage.shapes || [],
          images: activePage.images || [],
        },
      ]);
      setRedoStack([]);
    }

    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) => ({
        ...nb,
        pages: nb.pages.map((pg) =>
          pg.id === pageId
            ? {
                ...pg,
                strokes: newStrokes,
                shapes: newShapes,
                images: newImages !== undefined ? newImages : pg.images,
                updatedAt: new Date().toISOString(),
              }
            : pg
        ),
      })),
    }));
  };

  const handleUpdatePdfAnnotations = (
    pdfId: string,
    pageNum: number,
    newStrokes: Stroke[],
    newShapes: ShapeElement[],
    newImages?: ImageElement[]
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      pdfs: prev.pdfs.map((pdf) =>
        pdf.id === pdfId
          ? {
              ...pdf,
              annotations: {
                ...pdf.annotations,
                [pageNum]: {
                  pageNumber: pageNum,
                  strokes: newStrokes,
                  shapes: newShapes,
                  images: newImages !== undefined ? newImages : pdf.annotations?.[pageNum]?.images,
                },
              },
            }
          : pdf
      ),
    }));
  };

  // Insert Image or PDF from File input directly
  const handleInsertMedia = (file: File) => {
    if (!activePage && !activePdf) {
      alert('Please open or create a page first to insert media.');
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          const dataUrl = e.target.result;
          const img = new Image();
          img.onload = () => {
            const natW = img.naturalWidth || 600;
            const natH = img.naturalHeight || 400;
            const displayW = Math.min(450, natW);
            const displayH = Math.round((displayW / natW) * natH);

            const newImage: ImageElement = {
              id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              src: dataUrl,
              name: file.name,
              x: 80,
              y: 80,
              width: displayW,
              height: displayH,
              naturalWidth: natW,
              naturalHeight: natH,
              opacity: 1,
              rotation: 0,
              brightness: 100,
              contrast: 100,
              saturation: 100,
              grayscale: 0,
              invert: 0,
              blur: 0,
              sourceType: 'image',
            };

            if (activePage) {
              const currentImages = activePage.images || [];
              handleUpdatePageStrokes(activePage.id, activePage.strokes, activePage.shapes, [
                ...currentImages,
                newImage,
              ]);
            }
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      handleUploadPdf(file);
    }
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (undoStack.length === 0 || !activePage) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      {
        strokes: activePage.strokes || [],
        shapes: activePage.shapes || [],
        images: activePage.images || [],
      },
    ]);
    setUndoStack((prev) => prev.slice(0, -1));

    handleUpdatePageStrokes(activePage.id, last.strokes, last.shapes, last.images);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activePage) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [
      ...prev,
      {
        strokes: activePage.strokes || [],
        shapes: activePage.shapes || [],
        images: activePage.images || [],
      },
    ]);
    setRedoStack((prev) => prev.slice(0, -1));

    handleUpdatePageStrokes(activePage.id, next.strokes, next.shapes, next.images);
  };

  const handleClearCanvas = () => {
    if (!confirm('Clear all strokes, shapes, and images on this page?')) return;
    if (activePage) {
      handleUpdatePageStrokes(activePage.id, [], [], []);
    }
  };

  // PDF File Upload Handler
  const handleUploadPdf = (file: File) => {
    const newPdf: PDFItem = {
      id: `pdf_${Date.now()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      totalPages: 3,
      annotations: {},
      tags: ['Imported PDF'],
      uploadedAt: new Date().toISOString(),
    };

    setWorkspace((prev) => ({
      ...prev,
      pdfs: [...prev.pdfs, newPdf],
    }));

    handleSelectPdf(newPdf.id);
  };

  const handleDeletePdf = (pdfId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      pdfs: prev.pdfs.filter((p) => p.id !== pdfId),
    }));
  };

  // Pen Presets Management
  const handleSavePreset = () => {
    const name = prompt('Enter preset name:', `${currentTool.toUpperCase()} Preset`);
    if (!name) return;

    const newPreset: PenPreset = {
      id: `p_${Date.now()}`,
      name,
      tool: currentTool,
      color,
      width: strokeWidth,
      opacity,
      handwritingMode,
    };
    setPenPresets((prev) => [...prev, newPreset]);
  };

  const handleApplyPreset = (preset: PenPreset) => {
    setCurrentTool(preset.tool);
    setColor(preset.color);
    setStrokeWidth(preset.width);
    setOpacity(preset.opacity);
    setHandwritingMode(preset.handwritingMode);
  };

  // Save / Sync Workspace as PDFs to local disk
  const handleExportPdf = async () => {
    if (localFsState.dirHandle) {
      await handleSyncLocalDirectory();
      alert('Your notebook and pages have been saved as PDF documents in your local folder!');
    } else {
      await handleConnectLocalDirectory();
    }
  };

  // AI Service Endpoints Caller
  const handleRunAiAction = async (
    actionType: 'beautify' | 'ocr' | 'summarize' | 'equation' | 'translate'
  ) => {
    if (!activePage && !activePdf) {
      alert('Please select an active notebook page or PDF to run AI features.');
      return;
    }

    setIsLoadingAi(true);
    setAiStatusText('Capturing canvas handwriting image...');

    try {
      // Create a snapshot canvas of current strokes
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1200;
      tempCanvas.height = 900;
      const ctx = tempCanvas.getContext('2d');
      if (ctx && activePage) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 900);
        activePage.strokes.forEach((st) => {
          ctx.strokeStyle = st.color;
          ctx.lineWidth = st.width;
          ctx.beginPath();
          st.points.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        });
      }

      const imageBase64 = tempCanvas.toDataURL('image/png');

      if (actionType === 'ocr') {
        setAiStatusText('Running Gemini AI OCR Vision Model...');
        const res = await fetch('/api/ai/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 }),
        });
        const data = await res.json();

        setAiModalData({
          title: 'Handwriting OCR Transcription',
          original: `Strokes on page: ${activePage?.strokes.length || 0}`,
          aiResult: data.text || 'No text detected.',
          actionType: 'ocr',
        });
        setAiModalOpen(true);
      } else if (actionType === 'beautify') {
        setAiStatusText('Beautifying handwriting strokes & structure...');
        const res = await fetch('/api/ai/beautify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mode: 'script' }),
        });
        const data = await res.json();

        setAiModalData({
          title: 'AI Handwriting Beautification',
          original: `Messy strokes count: ${activePage?.strokes.length || 0}`,
          aiResult: `Transcribed & Cleaned Transcript:\n\n${data.transcript || 'Handwritten lines aligned.'}\n\nSuggestions:\n- ${
            (data.suggestions || []).join('\n- ') || 'Great handwriting flow!'
          }`,
          actionType: 'beautify',
        });
        setAiModalOpen(true);
      } else if (actionType === 'summarize') {
        setAiStatusText('Summarizing handwritten notes...');
        const res = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, text: activePage?.ocrText }),
        });
        const data = await res.json();

        setAiModalData({
          title: 'AI Note Summary',
          original: activePage?.ocrText || 'Handwritten canvas strokes',
          aiResult: `Summary: ${data.summary || 'Summary generated.'}\n\nKey Takeaways:\n• ${
            (data.keyPoints || []).join('\n• ')
          }`,
          actionType: 'summarize',
        });
        setAiModalOpen(true);
      } else if (actionType === 'equation') {
        setAiStatusText('Parsing math equations & LaTeX...');
        const res = await fetch('/api/ai/equation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64 }),
        });
        const data = await res.json();

        setAiModalData({
          title: 'Math Equation Recognition',
          original: 'Handwritten math equation',
          aiResult: `LaTeX Formula:\n${data.latex || '$E = mc^2$'}\n\nExplanation:\n${
            data.explanation || 'Analyzed formula variables.'
          }`,
          actionType: 'equation',
        });
        setAiModalOpen(true);
      } else if (actionType === 'translate') {
        setAiStatusText('Translating notes...');
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: activePage?.ocrText || 'Hello world notes' }),
        });
        const data = await res.json();

        setAiModalData({
          title: 'Translated Handwriting',
          original: activePage?.ocrText || 'Original text',
          aiResult: data.translation || 'Translation complete.',
          actionType: 'translate',
        });
        setAiModalOpen(true);
      }
    } catch (err: any) {
      console.error('AI Action Failed:', err);
      alert(`AI Feature Error: ${err.message || 'Failed to communicate with backend'}`);
    } finally {
      setIsLoadingAi(false);
      setAiStatusText('');
    }
  };

  // Apply AI Modal Outcome to Page
  const handleApplyAiTransformation = () => {
    if (!activePage) return;

    if (aiModalData.actionType === 'ocr' || aiModalData.actionType === 'summarize') {
      setWorkspace((prev) => ({
        ...prev,
        notebooks: prev.notebooks.map((nb) => ({
          ...nb,
          pages: nb.pages.map((p) =>
            p.id === activePage.id ? { ...p, ocrText: aiModalData.aiResult } : p
          ),
        })),
      }));
    } else if (aiModalData.actionType === 'beautify') {
      // Beautify mode: Convert page strokes to mode 3 script strokes
      const beautifiedStrokes = activePage.strokes.map((st) => ({
        ...st,
        points: convertToElegantScript(st),
        isBeautified: true,
      }));

      handleUpdatePageStrokes(activePage.id, beautifiedStrokes, activePage.shapes);
    }
  };

  // Command Palette Actions Definitions
  const commandPaletteActions: CommandPaletteAction[] = [
    { id: 'act_link_fs', title: 'Link Local PC/Tablet Folder (Direct Disk Save)', category: 'Local Storage', shortcut: 'Ctrl+Shift+L', run: handleConnectLocalDirectory },
    { id: 'act_create_subfolder', title: 'Create Folder directly on Local Device', category: 'Local Storage', run: handleCreateLocalSubfolder },
    { id: 'act_create_subfile', title: 'Create File directly on Local Device', category: 'Local Storage', run: handleCreateLocalFile },
    { id: 'act_sync_fs', title: 'Sync & Save Now to Local Folder', category: 'Local Storage', shortcut: 'Ctrl+S', run: handleSyncLocalDirectory },
    { id: 'act_unlink_fs', title: 'Unlink Local Folder', category: 'Local Storage', run: handleDisconnectLocalDirectory },
    { id: 'act_new_page', title: 'New Blank Notebook Page', category: 'Notebook', shortcut: 'Ctrl+N', run: handleNewBlankPage },
    {
      id: 'act_insert_media',
      title: 'Insert Image or PDF to Canvas (PNG, JPG, SVG, PDF)',
      category: 'Media & Images',
      run: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf';
        input.onchange = (e: any) => {
          if (e.target.files?.[0]) handleInsertMedia(e.target.files[0]);
        };
        input.click();
      },
    },
    { id: 'act_tool_hand', title: 'Tool: Hand Grab & Drag (H / Space)', category: 'Tools', shortcut: 'H', run: () => setCurrentTool('hand') },
    { id: 'act_tool_cursor', title: 'Tool: Cursor Select & Transform (V)', category: 'Tools', shortcut: 'V', run: () => setCurrentTool('cursor') },
    { id: 'act_tool_pen', title: 'Tool: Fine Pen (P)', category: 'Tools', shortcut: 'P', run: () => setCurrentTool('pen') },
    { id: 'act_tool_fountain', title: 'Tool: Fountain Pen (Calligraphy)', category: 'Tools', run: () => setCurrentTool('fountain') },
    { id: 'act_tool_eraser', title: 'Tool: Eraser (E)', category: 'Tools', shortcut: 'E', run: () => setCurrentTool('eraser') },
    { id: 'act_tool_lasso', title: 'Tool: Lasso Selection (L)', category: 'Tools', shortcut: 'L', run: () => setCurrentTool('lasso') },
    { id: 'act_tool_highlighter', title: 'Tool: Highlighter', category: 'Tools', run: () => setCurrentTool('highlighter') },
    { id: 'act_beautify', title: 'Beautify Current Page (AI)', category: 'AI', run: () => handleRunAiAction('beautify') },
    { id: 'act_ocr', title: 'Run OCR to Markdown', category: 'AI', run: () => handleRunAiAction('ocr') },
    { id: 'act_summarize', title: 'Summarize Note', category: 'AI', run: () => handleRunAiAction('summarize') },
    { id: 'act_zen_mode', title: 'Zen Mode: Maximize Working Area (F11)', category: 'Workspace', shortcut: 'F11', run: () => setIsZenMode((z) => !z) },
    { id: 'act_fit_fullscreen', title: 'Workspace: Fit Edge-to-Edge Full Screen', category: 'Workspace', run: () => setPageAspectRatio('flexible') },
    { id: 'act_infinite_canvas', title: 'Workspace: Infinite Expansive Canvas', category: 'Workspace', run: () => setPageAspectRatio('infinite') },
    { id: 'act_4k_canvas', title: 'Workspace: 4K Ultra Canvas (3840x2160)', category: 'Workspace', run: () => setPageAspectRatio('4k-canvas') },
    { id: 'act_ultrawide_canvas', title: 'Workspace: 21:9 Ultra-Wide Canvas', category: 'Workspace', run: () => setPageAspectRatio('ultrawide') },
    { id: 'act_a4_landscape', title: 'Workspace: A4 Landscape', category: 'Workspace', run: () => setPageAspectRatio('a4-landscape') },
    { id: 'act_a4_portrait', title: 'Workspace: A4 Portrait', category: 'Workspace', run: () => setPageAspectRatio('a4-portrait') },
    { id: 'act_export_pdf', title: 'Sync / Save PDF Notes to Local Folder', category: 'Storage', shortcut: 'Ctrl+Shift+S', run: handleExportPdf },
    { id: 'act_mode1', title: 'Set Mode 1: Pure Curve Smoothing', category: 'Handwriting Engine', run: () => setHandwritingMode(1) },
    { id: 'act_mode2', title: 'Set Mode 2: Style Beautification', category: 'Handwriting Engine', run: () => setHandwritingMode(2) },
    { id: 'act_mode3', title: 'Set Mode 3: Elegant Script Conversion', category: 'Handwriting Engine', run: () => setHandwritingMode(3) },
    { id: 'act_theme_dark', title: 'Theme: VS Code Dark Plus', category: 'Appearance', run: () => setTheme('vscode-dark') },
    { id: 'act_theme_light', title: 'Theme: VS Code Light Plus', category: 'Appearance', run: () => setTheme('vscode-light') },
    { id: 'act_theme_monokai', title: 'Theme: Monokai Dark', category: 'Appearance', run: () => setTheme('monokai') },
    { id: 'act_theme_solarized', title: 'Theme: Solarized Dark', category: 'Appearance', run: () => setTheme('solarized-dark') },
    { id: 'act_theme_hc', title: 'Theme: High Contrast', category: 'Appearance', run: () => setTheme('high-contrast') },
    { id: 'act_clear', title: 'Clear Page Canvas', category: 'Canvas', run: handleClearCanvas },
  ];

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Zen Mode / Maximize Workspace (F11)
      if (e.key === 'F11') {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
        return;
      }
      // Toggle Sidebar (Ctrl+B / Cmd+B)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }
      // Escape to exit Zen Mode
      if (e.key === 'Escape' && isZenMode && !isCommandPaletteOpen && !aiModalOpen) {
        setIsZenMode(false);
        return;
      }
      // Save to Local Device (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (localFsState.dirHandle) {
          handleSyncLocalDirectory();
        } else {
          handleConnectLocalDirectory();
        }
      }
      // Command Palette (Ctrl+Shift+P)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // New Page (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewBlankPage();
      }
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Single Key Tool Selection (when not typing in an input/textarea)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isCommandPaletteOpen && !aiModalOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
          const key = e.key.toLowerCase();
          if (key === 'h') {
            setCurrentTool('hand');
          } else if (key === 'v') {
            setCurrentTool('cursor');
          } else if (key === 'p') {
            setCurrentTool('pen');
          } else if (key === 'e') {
            setCurrentTool('eraser');
          } else if (key === 'l') {
            setCurrentTool('lasso');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePage, undoStack, redoStack, isZenMode, isCommandPaletteOpen, aiModalOpen, localFsState.dirHandle]);

  const theme = THEMES[currentTheme];

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden font-sans select-none relative"
      style={{
        backgroundColor: theme.editorBg,
        color: theme.editorFg,
      }}
    >
      {/* Main Body: ActivityBar + Sidebar + Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Activity Bar (Hidden in Zen Mode to Maximize Working Area) */}
        {!isZenMode && (
          <ActivityBar
            activeTab={activeActivityTab}
            setActiveTab={(tab) => {
              setActiveActivityTab(tab);
              setIsSidebarOpen(true);
            }}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            currentTheme={currentTheme}
            setTheme={setTheme}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            tabletConnected={tabletConnected}
          />
        )}

        {/* Collapsible & Shrinkable Sidebar Panel (Hidden in Zen Mode) */}
        {!isZenMode && isSidebarOpen && (
          <div
            className={`h-full flex shrink-0 relative ${isDraggingSidebar ? '' : 'transition-all duration-150'}`}
            style={{ width: sidebarWidth }}
          >
            {activeActivityTab === 'explorer' && (
              <ExplorerPanel
                workspace={workspace}
                setWorkspace={setWorkspace}
                activePageId={activeTab?.pageId}
                onSelectPage={handleSelectPage}
                currentTheme={currentTheme}
                isShrunk={sidebarWidth < 180}
                onToggleShrink={handleToggleSidebarShrink}
                localFsState={localFsState}
                onConnectLocalDirectory={handleConnectLocalDirectory}
                onDisconnectLocalDirectory={handleDisconnectLocalDirectory}
                onToggleAutoSave={handleToggleAutoSave}
                onCreateLocalSubfolder={handleCreateLocalSubfolder}
                onCreateLocalFile={handleCreateLocalFile}
                onSyncLocalDirectory={handleSyncLocalDirectory}
              />
            )}
            {activeActivityTab === 'practice' && (
              <PracticePanel
                activeTemplate={activeTemplate}
                setActiveTemplate={setActiveTemplate}
                showTemplateOverlay={showTemplateOverlay}
                setShowTemplateOverlay={setShowTemplateOverlay}
                handwritingFeedback={handwritingFeedback}
                currentTheme={currentTheme}
              />
            )}
            {activeActivityTab === 'pdfs' && (
              <PdfPanel
                pdfs={workspace.pdfs}
                onUploadPdf={handleUploadPdf}
                onSelectPdf={handleSelectPdf}
                onDeletePdf={handleDeletePdf}
                activePdfId={activeTab?.pdfId}
                currentTheme={currentTheme}
              />
            )}
            {activeActivityTab === 'search' && (
              <SearchPanel
                workspace={workspace}
                onSelectPage={handleSelectPage}
                currentTheme={currentTheme}
              />
            )}
            {activeActivityTab === 'ai' && (
              <AiPanel
                handwritingMode={handwritingMode}
                setHandwritingMode={setHandwritingMode}
                onRunAiAction={handleRunAiAction}
                isLoadingAi={isLoadingAi}
                aiStatusText={aiStatusText}
                currentTheme={currentTheme}
              />
            )}
            {activeActivityTab === 'settings' && (
              <SettingsPanel
                tabletSettings={tabletSettings}
                setTabletSettings={setTabletSettings}
                currentTheme={currentTheme}
                setTheme={setTheme}
                defaultTemplate={defaultTemplate}
                setDefaultTemplate={setDefaultTemplate}
                pageAspectRatio={pageAspectRatio}
                setPageAspectRatio={setPageAspectRatio}
              />
            )}

            {/* Draggable Vertical Resize Bar on Right Edge (Supports Mouse & Touch on Tablets) */}
            <div
              onMouseDown={handleSidebarResizeStart}
              onTouchStart={handleSidebarResizeStart}
              className="absolute top-0 -right-2 w-4 h-full cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-30 group flex items-center justify-center transition-colors touch-none"
              title="Drag towards left to shrink/collapse sidebar and maximize working area size"
            >
              <div className="w-[3px] h-10 rounded-full bg-white/30 group-hover:bg-sky-300 group-active:bg-sky-200 shadow-sm" />
            </div>
          </div>
        )}

        {/* Right Editor Work Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Multi-Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewBlankPage}
            currentTheme={currentTheme}
          />

          {/* Docked Pen Toolbar */}
          <PenToolbar
            currentTool={currentTool}
            setCurrentTool={setCurrentTool}
            selectedShape={selectedShape}
            setSelectedShape={setSelectedShape}
            color={color}
            setColor={setColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            opacity={opacity}
            setOpacity={setOpacity}
            handwritingMode={handwritingMode}
            setHandwritingMode={setHandwritingMode}
            penPresets={penPresets}
            onSavePreset={handleSavePreset}
            onApplyPreset={handleApplyPreset}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearCanvas={handleClearCanvas}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            currentTheme={currentTheme}
            onInsertMedia={handleInsertMedia}
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode(!isZenMode)}
          />

          {/* Canvas Viewport Workspace */}
          <CanvasEditor
            page={activePage}
            pdf={activePdf}
            tool={currentTool}
            selectedShape={selectedShape}
            color={color}
            strokeWidth={strokeWidth}
            opacity={opacity}
            handwritingMode={handwritingMode}
            tabletSettings={tabletSettings}
            currentTheme={currentTheme}
            activeTemplate={activeTemplate}
            showTemplateOverlay={showTemplateOverlay}
            onFeedbackUpdate={(fb) => setHandwritingFeedback(fb)}
            onUpdatePageStrokes={handleUpdatePageStrokes}
            onUpdatePdfAnnotations={handleUpdatePdfAnnotations}
            onUpdateTabletPressure={(p) => setTabletPressure(p)}
            pageAspectRatio={pageAspectRatio}
            onSetPageAspectRatio={setPageAspectRatio}
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode(!isZenMode)}
          />

          {/* Bottom Page Control Toolbar (Outside Working Area Canvas) */}
          <BottomPageToolbar
            pageAspectRatio={pageAspectRatio}
            onSetPageAspectRatio={setPageAspectRatio}
            onAddPage={handleNewBlankPage}
            notebookPages={activeNotebook?.pages}
            currentPageIndex={activeNotebook?.pages.findIndex((p) => p.id === activePage?.id)}
            onSelectPage={(pageId) => activeNotebook && handleSelectPage(activeNotebook.id, pageId)}
            currentTheme={currentTheme}
            activePageTitle={activePage?.title}
            activePage={activePage}
            activeNotebook={activeNotebook}
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode(!isZenMode)}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        currentTool={currentTool}
        strokeWidth={strokeWidth}
        handwritingMode={handwritingMode}
        tabletPressure={tabletPressure}
        currentTheme={currentTheme}
        tabletConnected={tabletConnected}
        localFolderName={localFsState.folderName}
        onConnectLocalDirectory={handleConnectLocalDirectory}
      />

      {/* VS Code Command Palette (Ctrl+Shift+P) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={commandPaletteActions}
        currentTheme={currentTheme}
      />

      {/* AI Diff Preview Modal */}
      <AiDiffModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onApply={handleApplyAiTransformation}
        title={aiModalData.title}
        originalContent={aiModalData.original}
        aiOutputContent={aiModalData.aiResult}
        currentTheme={currentTheme}
      />
    </div>
  );
}
