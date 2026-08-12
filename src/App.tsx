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

export default function App() {
  // Primary Workspace State
  const [workspace, setWorkspace] = useState<Workspace>(INITIAL_WORKSPACE);
  const [currentTheme, setTheme] = useState<ThemeId>('vscode-dark');

  // Sidebar & Navigation
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isSidebarShrunk, setIsSidebarShrunk] = useState<boolean>(false);
  const isDraggingSidebarRef = useRef<boolean>(false);

  const handleSidebarResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebarRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSidebarRef.current) return;
      // ActivityBar width is 48px
      const newWidth = Math.max(120, Math.min(600, moveEvent.clientX - 48));
      setSidebarWidth(newWidth);
      if (newWidth < 170) {
        setIsSidebarShrunk(true);
      } else {
        setIsSidebarShrunk(false);
      }
    };

    const handleMouseUp = () => {
      isDraggingSidebarRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleToggleSidebarShrink = useCallback(() => {
    setIsSidebarShrunk((prev) => {
      if (!prev) {
        setSidebarWidth(140);
        return true;
      } else {
        setSidebarWidth(260);
        return false;
      }
    });
  }, []);

  // Tabs State
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab_schrodinger',
      type: 'page',
      notebookId: 'nb_quantum',
      pageId: 'pg_schrodinger',
      title: '1. Schrödinger Equation',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_schrodinger');

  // Pen Tools & Drawing Settings
  const [currentTool, setCurrentTool] = useState<PenToolType>('fountain');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [color, setColor] = useState<string>('#1a1a2e');
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [handwritingMode, setHandwritingMode] = useState<HandwritingMode>(1);
  const [defaultTemplate, setDefaultTemplate] = useState<PageTemplate>('ruled');
  const [pageAspectRatio, setPageAspectRatio] = useState<PageAspectRatio>('a4-portrait');
  const [penPresets, setPenPresets] = useState<PenPreset[]>(INITIAL_PEN_PRESETS);
  const [tabletSettings, setTabletSettings] = useState<TabletSettings>(INITIAL_TABLET_SETTINGS);

  // Practice Reference Guides & Handwriting Feedback State
  const [activeTemplate, setActiveTemplate] = useState<PracticeTemplate | null>(PRACTICE_TEMPLATES[0]);
  const [showTemplateOverlay, setShowTemplateOverlay] = useState<boolean>(false);
  const [handwritingFeedback, setHandwritingFeedback] = useState<HandwritingFeedback | null>(null);

  // Tablet Monitoring State
  const [tabletPressure, setTabletPressure] = useState<number>(0.5);
  const [tabletConnected, setTabletConnected] = useState<boolean>(true);

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
  const [undoStack, setUndoStack] = useState<{ strokes: Stroke[]; shapes: ShapeElement[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ strokes: Stroke[]; shapes: ShapeElement[] }[]>([]);

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

  // Canvas Stroke Updates
  const handleUpdatePageStrokes = (
    pageId: string,
    newStrokes: Stroke[],
    newShapes: ShapeElement[]
  ) => {
    if (activePage) {
      setUndoStack((prev) => [...prev, { strokes: activePage.strokes, shapes: activePage.shapes }]);
      setRedoStack([]);
    }

    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((nb) => ({
        ...nb,
        pages: nb.pages.map((pg) =>
          pg.id === pageId
            ? { ...pg, strokes: newStrokes, shapes: newShapes, updatedAt: new Date().toISOString() }
            : pg
        ),
      })),
    }));
  };

  const handleUpdatePdfAnnotations = (
    pdfId: string,
    pageNum: number,
    newStrokes: Stroke[],
    newShapes: ShapeElement[]
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      pdfs: prev.pdfs.map((pdf) =>
        pdf.id === pdfId
          ? {
              ...pdf,
              annotations: {
                ...pdf.annotations,
                [pageNum]: { pageNumber: pageNum, strokes: newStrokes, shapes: newShapes },
              },
            }
          : pdf
      ),
    }));
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (undoStack.length === 0 || !activePage) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { strokes: activePage.strokes, shapes: activePage.shapes }]);
    setUndoStack((prev) => prev.slice(0, -1));

    handleUpdatePageStrokes(activePage.id, last.strokes, last.shapes);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activePage) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { strokes: activePage.strokes, shapes: activePage.shapes }]);
    setRedoStack((prev) => prev.slice(0, -1));

    handleUpdatePageStrokes(activePage.id, next.strokes, next.shapes);
  };

  const handleClearCanvas = () => {
    if (!confirm('Clear all strokes and shapes on this page?')) return;
    if (activePage) {
      handleUpdatePageStrokes(activePage.id, [], []);
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

  // Export Document as PDF using jsPDF
  const handleExportPdf = () => {
    if (!activePage) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setFontSize(20);
    doc.text(activePage.title, 40, 50);

    doc.setFontSize(12);
    doc.text(`Notebook: ${activeNotebook?.title || 'Workspace'}`, 40, 75);
    doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 40, 95);

    if (activePage.ocrText) {
      doc.setFontSize(10);
      doc.text('OCR Transcription:', 40, 130);
      doc.text(activePage.ocrText, 40, 150, { maxWidth: 500 });
    }

    doc.save(`${activePage.title.replace(/\s+/g, '_')}.pdf`);
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
    { id: 'act_new_page', title: 'New Blank Notebook Page', category: 'Notebook', shortcut: 'Ctrl+N', run: handleNewBlankPage },
    { id: 'act_beautify', title: 'Beautify Current Page (AI)', category: 'AI', run: () => handleRunAiAction('beautify') },
    { id: 'act_ocr', title: 'Run OCR to Markdown', category: 'AI', run: () => handleRunAiAction('ocr') },
    { id: 'act_summarize', title: 'Summarize Note', category: 'AI', run: () => handleRunAiAction('summarize') },
    { id: 'act_export_pdf', title: 'Export Notebook to PDF', category: 'Export', shortcut: 'Ctrl+Shift+E', run: handleExportPdf },
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePage, undoStack, redoStack]);

  const theme = THEMES[currentTheme];

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden font-sans select-none"
      style={{
        backgroundColor: theme.editorBg,
        color: theme.editorFg,
      }}
    >
      {/* Main Body: ActivityBar + Sidebar + Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Activity Bar */}
        <ActivityBar
          activeTab={activeActivityTab}
          setActiveTab={(tab) => {
            if (activeActivityTab === tab && isSidebarOpen) {
              setIsSidebarOpen(false);
            } else {
              setActiveActivityTab(tab);
              setIsSidebarOpen(true);
            }
          }}
          currentTheme={currentTheme}
          setTheme={setTheme}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          tabletConnected={tabletConnected}
        />

        {/* Collapsible & Shrinkable Sidebar Panel */}
        {isSidebarOpen && (
          <div
            className="h-full flex shrink-0 relative transition-all duration-150"
            style={{ width: isSidebarShrunk ? 140 : sidebarWidth }}
          >
            {activeActivityTab === 'explorer' && (
              <ExplorerPanel
                workspace={workspace}
                setWorkspace={setWorkspace}
                activePageId={activeTab?.pageId}
                onSelectPage={handleSelectPage}
                currentTheme={currentTheme}
                isShrunk={isSidebarShrunk}
                onToggleShrink={handleToggleSidebarShrink}
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

            {/* Draggable Vertical Resize Bar on Right Edge */}
            <div
              onMouseDown={handleSidebarResizeMouseDown}
              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 z-30 group flex items-center justify-center transition-colors"
              title="Drag to adjust sidebar width (shrink/expand)"
            >
              <div className="w-[2px] h-8 rounded-full bg-white/20 group-hover:bg-sky-300" />
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
