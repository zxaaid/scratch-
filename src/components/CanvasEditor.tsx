import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Point,
  Stroke,
  ShapeElement,
  Page,
  PDFItem,
  PenToolType,
  ShapeType,
  HandwritingMode,
  PageTemplate,
  TabletSettings,
  ThemeId,
  HandwritingFeedback,
  PracticeTemplate,
  PageAspectRatio,
} from '../types';
import {
  filterJitter,
  catmullRomSmooth,
  calculateWidth,
  beautifyPreservingStyle,
  convertToElegantScript,
  predictStrokePoints,
  analyzeHandwritingQuality,
} from '../lib/handwritingEngine';
import { THEMES } from '../lib/themes';
import { PAGE_ASPECT_PRESETS } from '../lib/pageDimensions';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  RotateCw,
  Type,
  StickyNote,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RectangleHorizontal,
  FileText,
} from 'lucide-react';

interface CanvasEditorProps {
  page?: Page;
  pdf?: PDFItem;
  pdfPageNum?: number;
  onUpdatePageStrokes?: (pageId: string, strokes: Stroke[], shapes: ShapeElement[]) => void;
  onUpdatePdfAnnotations?: (
    pdfId: string,
    pageNum: number,
    strokes: Stroke[],
    shapes: ShapeElement[]
  ) => void;
  tool: PenToolType;
  selectedShape: ShapeType;
  color: string;
  strokeWidth: number;
  opacity: number;
  handwritingMode: HandwritingMode;
  tabletSettings: TabletSettings;
  currentTheme: ThemeId;
  activeTemplate: PracticeTemplate | null;
  showTemplateOverlay: boolean;
  onFeedbackUpdate?: (feedback: HandwritingFeedback) => void;
  onUpdateTabletPressure?: (pressure: number) => void;
  onBeautifySelection?: (selectedStrokes: Stroke[]) => void;
  notebookPages?: Page[];
  currentPageIndex?: number;
  onSelectPage?: (pageId: string) => void;
  onAddPage?: () => void;
  pageAspectRatio?: PageAspectRatio;
  onSetPageAspectRatio?: (ratio: PageAspectRatio) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  page,
  pdf,
  pdfPageNum = 1,
  onUpdatePageStrokes,
  onUpdatePdfAnnotations,
  tool,
  selectedShape,
  color,
  strokeWidth,
  opacity,
  handwritingMode,
  tabletSettings,
  currentTheme,
  activeTemplate,
  showTemplateOverlay,
  onFeedbackUpdate,
  onUpdateTabletPressure,
  onBeautifySelection,
  notebookPages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
  pageAspectRatio = 'a4-portrait',
  onSetPageAspectRatio,
}) => {
  const theme = THEMES[currentTheme];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport State (Pan, Zoom)
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Saved Strokes and Shapes in State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);

  // Refs for zero-latency drawing without React re-renders on pointer move
  const isDrawingRef = useRef<boolean>(false);
  const activePointsRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<ShapeElement[]>([]);

  // Selection & Transform State
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [isLassoing, setIsLassoing] = useState<boolean>(false);

  // Interaction Mode Refs for Dragging/Rotating Selection
  const isRotatingRef = useRef<boolean>(false);
  const isTranslatingRef = useRef<boolean>(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastAngleRadRef = useRef<number>(0);

  // Box Selection Drag Ref (for cursor box drag)
  const isBoxSelectingRef = useRef<boolean>(false);
  const boxSelectStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [boxSelectRect, setBoxSelectRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Text / Sticky Note Edit Modal State
  const [editingTextElement, setEditingTextElement] = useState<{
    id?: string;
    x: number;
    y: number;
    text: string;
    isSticky: boolean;
  } | null>(null);

  // Sync refs with state
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Sync internal strokes with props
  useEffect(() => {
    if (page) {
      const initialStrokes = page.strokes || [];
      const initialShapes = page.shapes || [];
      setStrokes(initialStrokes);
      setShapes(initialShapes);
      strokesRef.current = initialStrokes;
      shapesRef.current = initialShapes;

      // Trigger initial handwriting analysis
      const fb = analyzeHandwritingQuality(initialStrokes, activeTemplate || undefined);
      if (onFeedbackUpdate) onFeedbackUpdate(fb);
    } else if (pdf) {
      const pdfAnno = pdf.annotations?.[pdfPageNum];
      const initialStrokes = pdfAnno?.strokes || [];
      const initialShapes = pdfAnno?.shapes || [];
      setStrokes(initialStrokes);
      setShapes(initialShapes);
      strokesRef.current = initialStrokes;
      shapesRef.current = initialShapes;
    }
  }, [page, pdf, pdfPageNum]);

  // Save Canvas Data
  const saveCanvasData = useCallback(
    (newStrokes: Stroke[], newShapes: ShapeElement[]) => {
      if (page && onUpdatePageStrokes) {
        onUpdatePageStrokes(page.id, newStrokes, newShapes);
      } else if (pdf && onUpdatePdfAnnotations) {
        onUpdatePdfAnnotations(pdf.id, pdfPageNum, newStrokes, newShapes);
      }
    },
    [page, pdf, pdfPageNum, onUpdatePageStrokes, onUpdatePdfAnnotations]
  );

  // Convert Screen Coordinates to Canvas World Coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    if (!canvasRef.current) return { x: 0, y: 0, pressure: 0.5, time: Date.now() };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const worldX = (clientX - panX) / zoom;
    const worldY = (clientY - panY) / zoom;

    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    if (onUpdateTabletPressure) {
      onUpdateTabletPressure(pressure);
    }

    return {
      x: worldX,
      y: worldY,
      pressure: Math.max(0.05, pressure),
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      time: Date.now(),
    };
  };

  // Compute Selection Bounding Box
  const getSelectionBounds = useCallback(() => {
    const strokeIdSet = new Set(selectedStrokeIds);
    const shapeIdSet = new Set(selectedShapeIds);

    const xs: number[] = [];
    const ys: number[] = [];

    strokesRef.current.forEach((st) => {
      if (strokeIdSet.has(st.id)) {
        st.points.forEach((p) => {
          xs.push(p.x);
          ys.push(p.y);
        });
      }
    });

    shapesRef.current.forEach((sh) => {
      if (shapeIdSet.has(sh.id)) {
        const w = sh.width || (sh.type === 'text' ? 150 : 120);
        const h = sh.height || (sh.type === 'text' ? 30 : 80);
        xs.push(sh.x, sh.x + w);
        ys.push(sh.y, sh.y + h);
        sh.points?.forEach((p) => {
          xs.push(p.x);
          ys.push(p.y);
        });
      }
    });

    if (xs.length === 0 || ys.length === 0) return null;

    const minX = Math.min(...xs) - 8;
    const maxX = Math.max(...xs) + 8;
    const minY = Math.min(...ys) - 8;
    const maxY = Math.max(...ys) + 8;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }, [selectedStrokeIds, selectedShapeIds]);

  // Translate Selected Items by (dx, dy)
  const translateSelectedItems = useCallback(
    (dx: number, dy: number) => {
      if (selectedStrokeIds.length === 0 && selectedShapeIds.length === 0) return;

      const strokeIdSet = new Set(selectedStrokeIds);
      const shapeIdSet = new Set(selectedShapeIds);

      const updatedStrokes = strokesRef.current.map((st) => {
        if (strokeIdSet.has(st.id)) {
          const newPts = st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
          const newSmoothed = st.smoothedPoints?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
          return { ...st, points: newPts, smoothedPoints: newSmoothed };
        }
        return st;
      });

      const updatedShapes = shapesRef.current.map((sh) => {
        if (shapeIdSet.has(sh.id)) {
          const newPts = sh.points?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
          return { ...sh, x: sh.x + dx, y: sh.y + dy, points: newPts };
        }
        return sh;
      });

      setStrokes(updatedStrokes);
      strokesRef.current = updatedStrokes;
      setShapes(updatedShapes);
      shapesRef.current = updatedShapes;
      saveCanvasData(updatedStrokes, updatedShapes);
    },
    [selectedStrokeIds, selectedShapeIds, saveCanvasData]
  );

  // Rotate Selected Items by dAngleRad around center (cx, cy)
  const rotateSelectedItems = useCallback(
    (dAngleRad: number, cx: number, cy: number) => {
      if (selectedStrokeIds.length === 0 && selectedShapeIds.length === 0) return;

      const strokeIdSet = new Set(selectedStrokeIds);
      const shapeIdSet = new Set(selectedShapeIds);
      const cos = Math.cos(dAngleRad);
      const sin = Math.sin(dAngleRad);

      const rotatePoint = (p: Point): Point => {
        const rx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
        const ry = cy + (p.x - cx) * sin + (p.y - cy) * cos;
        return { ...p, x: rx, y: ry };
      };

      const updatedStrokes = strokesRef.current.map((st) => {
        if (strokeIdSet.has(st.id)) {
          const newPts = st.points.map(rotatePoint);
          const newSmoothed = st.smoothedPoints?.map(rotatePoint);
          return { ...st, points: newPts, smoothedPoints: newSmoothed };
        }
        return st;
      });

      const dAngleDeg = (dAngleRad * 180) / Math.PI;

      const updatedShapes = shapesRef.current.map((sh) => {
        if (shapeIdSet.has(sh.id)) {
          const rx = cx + (sh.x - cx) * cos - (sh.y - cy) * sin;
          const ry = cy + (sh.x - cx) * sin + (sh.y - cy) * cos;
          const newPts = sh.points?.map(rotatePoint);
          const newRot = ((sh.rotation || 0) + dAngleDeg) % 360;
          return { ...sh, x: rx, y: ry, rotation: newRot, points: newPts };
        }
        return sh;
      });

      setStrokes(updatedStrokes);
      strokesRef.current = updatedStrokes;
      setShapes(updatedShapes);
      shapesRef.current = updatedShapes;
      saveCanvasData(updatedStrokes, updatedShapes);
    },
    [selectedStrokeIds, selectedShapeIds, saveCanvasData]
  );

  // Delete Selected Items
  const deleteSelectedItems = useCallback(() => {
    const strokeIdSet = new Set(selectedStrokeIds);
    const shapeIdSet = new Set(selectedShapeIds);

    const remainingStrokes = strokesRef.current.filter((st) => !strokeIdSet.has(st.id));
    const remainingShapes = shapesRef.current.filter((sh) => !shapeIdSet.has(sh.id));

    setStrokes(remainingStrokes);
    strokesRef.current = remainingStrokes;
    setShapes(remainingShapes);
    shapesRef.current = remainingShapes;

    setSelectedStrokeIds([]);
    setSelectedShapeIds([]);
    saveCanvasData(remainingStrokes, remainingShapes);
  }, [selectedStrokeIds, selectedShapeIds, saveCanvasData]);

  // Keyboard Event Listener for Arrow Keys, Rotation, and Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextElement) return;
      if (selectedStrokeIds.length === 0 && selectedShapeIds.length === 0) return;

      const step = e.shiftKey ? 10 : 2;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        translateSelectedItems(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        translateSelectedItems(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        translateSelectedItems(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        translateSelectedItems(0, step);
      } else if (e.key === '[' || (e.key.toLowerCase() === 'r' && e.shiftKey)) {
        e.preventDefault();
        const bounds = getSelectionBounds();
        if (bounds) rotateSelectedItems((-15 * Math.PI) / 180, bounds.cx, bounds.cy);
      } else if (e.key === ']' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const bounds = getSelectionBounds();
        if (bounds) rotateSelectedItems((15 * Math.PI) / 180, bounds.cx, bounds.cy);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedItems();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedStrokeIds([]);
        setSelectedShapeIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedStrokeIds,
    selectedShapeIds,
    editingTextElement,
    translateSelectedItems,
    rotateSelectedItems,
    deleteSelectedItems,
    getSelectionBounds,
  ]);

  // Render Background Grid Paper
  const renderBackgroundGrid = (
    ctx: CanvasRenderingContext2D,
    paperX: number,
    paperY: number,
    width: number,
    height: number,
    template: PageTemplate
  ) => {
    ctx.save();
    ctx.fillStyle = theme.canvasPaper.blank;
    ctx.fillRect(paperX, paperY, width, height);

    ctx.strokeStyle = theme.canvasPaper.ruledLine;
    ctx.lineWidth = 1 / zoom;

    if (template === 'ruled' || template === 'dark-ruled') {
      const lineHeight = 36;
      for (let y = paperY + 60; y < paperY + height; y += lineHeight) {
        ctx.beginPath();
        ctx.moveTo(paperX, y);
        ctx.lineTo(paperX + width, y);
        ctx.stroke();
      }
      // Left margin line
      ctx.strokeStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(paperX + 70, paperY);
      ctx.lineTo(paperX + 70, paperY + height);
      ctx.stroke();
    } else if (template === 'grid' || template === 'graph' || template === 'dark-grid') {
      const gridSize = template === 'graph' ? 16 : 28;
      for (let x = paperX; x < paperX + width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, paperY);
        ctx.lineTo(x, paperY + height);
        ctx.stroke();
      }
      for (let y = paperY; y < paperY + height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(paperX, y);
        ctx.lineTo(paperX + width, y);
        ctx.stroke();
      }
    } else if (template === 'dot') {
      ctx.fillStyle = theme.canvasPaper.dotColor;
      const dotSpacing = 28;
      for (let x = paperX + 20; x < paperX + width; x += dotSpacing) {
        for (let y = paperY + 20; y < paperY + height; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // LAYER 2: Practice Template Guide Background Overlay
  const renderTemplateOverlay = (ctx: CanvasRenderingContext2D, paperX: number = 60, paperY: number = 60) => {
    if (!showTemplateOverlay || !activeTemplate) return;

    ctx.save();
    ctx.fillStyle = 'rgba(14, 116, 144, 0.25)';
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.35)';
    ctx.lineWidth = 1.2 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);

    const startX = paperX + 90;
    const startY = paperY + 120;

    ctx.font = '32px "Dancing Script", "Caveat", "Brush Script MT", cursive, sans-serif';
    ctx.fillText(activeTemplate.referenceText, startX, startY);

    ctx.beginPath();
    ctx.moveTo(startX - 20, startY + 6);
    ctx.lineTo(startX + 800, startY + 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX - 20, startY - 26);
    ctx.lineTo(startX + 800, startY - 26);
    ctx.stroke();

    ctx.restore();
  };

  // Render Single Stroke
  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const pts = stroke.smoothedPoints || stroke.points;
    if (pts.length < 2) return;

    const isSelected = selectedStrokeIds.includes(stroke.id);

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isSelected) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
    }

    if (stroke.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
    }

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const segWidth = calculateWidth(
        stroke.width,
        stroke.tool,
        p1,
        p2,
        tabletSettings.pressureSensitivity
      );

      ctx.beginPath();
      ctx.lineWidth = segWidth;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Render Shape or Text or Sticky
  const renderShape = (ctx: CanvasRenderingContext2D, shape: ShapeElement) => {
    const isSelected = selectedShapeIds.includes(shape.id);

    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.fillColor || shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.globalAlpha = shape.opacity;

    if (isSelected) {
      ctx.shadowColor = '#007acc';
      ctx.shadowBlur = 12;
    }

    // Apply Rotation Transform if present
    if (shape.rotation) {
      const w = shape.width || 120;
      const h = shape.height || 80;
      ctx.translate(shape.x + w / 2, shape.y + h / 2);
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.translate(-(shape.x + w / 2), -(shape.y + h / 2));
    }

    if (shape.type === 'rectangle') {
      ctx.strokeRect(shape.x, shape.y, shape.width || 120, shape.height || 80);
    } else if (shape.type === 'circle') {
      ctx.beginPath();
      const radius = Math.abs(shape.width || 60) / 2;
      ctx.arc(shape.x + radius, shape.y + radius, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.type === 'arrow' || shape.type === 'line') {
      const endX = shape.x + (shape.width || 120);
      const endY = shape.y + (shape.height || 0);

      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (shape.type === 'arrow') {
        const angle = Math.atan2(endY - shape.y, endX - shape.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    } else if (shape.type === 'sticky') {
      const width = shape.width || 200;
      const height = shape.height || 130;

      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 8;
      ctx.fillRect(shape.x, shape.y, width, height);

      ctx.fillStyle = '#fde047';
      ctx.fillRect(shape.x, shape.y, width, 18);

      ctx.fillStyle = '#1e293b';
      ctx.font = '13px sans-serif';
      ctx.shadowBlur = 0;
      const text = shape.text || 'Sticky Note';
      ctx.fillText(text, shape.x + 10, shape.y + 40, width - 20);

      ctx.fillStyle = '#854d0e';
      ctx.font = '10px sans-serif';
      ctx.fillText('⁞⁞ Drag', shape.x + width - 42, shape.y + 13);
    } else if (shape.type === 'text') {
      const text = shape.text || 'Text Box';
      ctx.font = '18px sans-serif';
      ctx.fillStyle = shape.color;
      ctx.fillText(text, shape.x, shape.y);
    }

    ctx.restore();
  };

  // Main Canvas Render Loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Fill outer workspace backdrop
    ctx.fillStyle = theme.editorBg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-portrait'];
    const isFlexible = pageAspectRatio === 'flexible';

    let pageWidth = pagePreset.width;
    let pageHeight = pagePreset.height;

    if (isFlexible || pageWidth === 0) {
      pageWidth = Math.max(300, (width - 48) / zoom);
      pageHeight = Math.max(300, (height - 48) / zoom);
    }

    const paperX = Math.max(24 / zoom, (width / zoom - pageWidth) / 2);
    const paperY = Math.max(24 / zoom, (height / zoom - pageHeight) / 2);

    // LAYER 1: A4 Paper Card with Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18 / zoom;
    ctx.shadowOffsetY = 6 / zoom;
    ctx.fillStyle = theme.canvasPaper.blank;
    ctx.fillRect(paperX, paperY, pageWidth, pageHeight);
    ctx.restore();

    // Page Border Outline
    ctx.strokeStyle = currentTheme.includes('dark') ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(paperX, paperY, pageWidth, pageHeight);

    // Render Grid Paper Background
    renderBackgroundGrid(ctx, paperX, paperY, pageWidth, pageHeight, page?.template || 'ruled');

    // LAYER 2: Practice Template Guide Background Overlay
    renderTemplateOverlay(ctx, paperX, paperY);

    // LAYER 3: Render Shapes, Text Boxes & Sticky Cards
    shapesRef.current.forEach((s) => renderShape(ctx, s));

    // LAYER 3: Render Saved Strokes
    strokesRef.current.forEach((st) => renderStroke(ctx, st));

    // LAYER 3: Render Active Pointer Stroke
    const activePts = activePointsRef.current;
    if (isDrawingRef.current && activePts.length > 1) {
      const activeStroke: Stroke = {
        id: 'active',
        tool,
        color,
        width: strokeWidth,
        opacity,
        points: activePts,
        smoothedPoints: catmullRomSmooth(
          filterJitter(activePts, tabletSettings.smoothingStrength),
          3
        ),
      };

      renderStroke(ctx, activeStroke);

      const predicted = predictStrokePoints(activePts, tabletSettings.predictionLatencyMs);
      if (predicted.length > 0) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity * 0.4;
        ctx.lineWidth = strokeWidth * 0.8;
        ctx.beginPath();
        ctx.moveTo(activePts[activePts.length - 1].x, activePts[activePts.length - 1].y);
        ctx.lineTo(predicted[0].x, predicted[0].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Active Lasso Trail
    if (isLassoing && lassoPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    }

    // Active Drag Box Selection Rectangle
    if (boxSelectRect) {
      ctx.save();
      ctx.strokeStyle = '#007acc';
      ctx.fillStyle = 'rgba(0, 122, 204, 0.15)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.fillRect(boxSelectRect.x, boxSelectRect.y, boxSelectRect.w, boxSelectRect.h);
      ctx.strokeRect(boxSelectRect.x, boxSelectRect.y, boxSelectRect.w, boxSelectRect.h);
      ctx.restore();
    }

    // LAYER 4: SELECTION BOUNDING BOX & ANGLE ROTATION HANDLE KNOB
    const bounds = getSelectionBounds();
    if (bounds) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);

      // Selection Frame Rectangle
      ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

      // Rotation Handle Stem Line
      const handleStemY = bounds.minY - 26 / zoom;
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(bounds.cx, bounds.minY);
      ctx.lineTo(bounds.cx, handleStemY);
      ctx.stroke();

      // Rotation Handle Circular Knob
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(bounds.cx, handleStemY, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();

      // Corner Sizing Handle Dots
      const handles = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY },
      ];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#007acc';
      ctx.lineWidth = 1.5 / zoom;
      handles.forEach((h) => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      ctx.restore();
    }

    ctx.restore();
  }, [
    panX,
    panY,
    zoom,
    page,
    tool,
    color,
    strokeWidth,
    opacity,
    tabletSettings,
    showTemplateOverlay,
    activeTemplate,
    getSelectionBounds,
    isLassoing,
    lassoPoints,
    boxSelectRect,
    selectedStrokeIds,
    selectedShapeIds,
    pageAspectRatio,
    theme,
  ]);

  // Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      drawCanvas();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawCanvas]);

  // Container Resize Observer for auto-adjusting working area & page size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasSize = () => {
      if (canvasRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0 && (canvasRef.current.width !== w || canvasRef.current.height !== h)) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
        }
      }
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserver.observe(container);

    window.addEventListener('resize', updateCanvasSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 4 || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      return;
    }

    const point = getCanvasCoords(e);
    const bounds = getSelectionBounds();

    // 1. Check Rotation Handle Click
    if (bounds) {
      const handleY = bounds.minY - 26 / zoom;
      const distToRotationHandle = Math.hypot(point.x - bounds.cx, point.y - handleY);
      if (distToRotationHandle < 18 / zoom) {
        isRotatingRef.current = true;
        lastAngleRadRef.current = Math.atan2(point.y - bounds.cy, point.x - bounds.cx);
        return;
      }

      // 2. Check Inside Selection Box Click (Translation / Dragging Move)
      if (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      ) {
        isTranslatingRef.current = true;
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }
    }

    // 3. CURSOR TOOL BEHAVIOR: Select & Grab Elements directly
    if (tool === 'cursor') {
      // Check if clicking directly on a shape or text element
      const clickedShape = shapesRef.current.slice().reverse().find((elem) => {
        const w = elem.width || (elem.type === 'text' ? 150 : 120);
        const h = elem.height || (elem.type === 'text' ? 30 : 80);
        return (
          point.x >= elem.x - 10 &&
          point.x <= elem.x + w + 10 &&
          point.y >= elem.y - 25 &&
          point.y <= elem.y + h + 10
        );
      });

      if (clickedShape) {
        setSelectedShapeIds([clickedShape.id]);
        if (!e.shiftKey) setSelectedStrokeIds([]);
        isTranslatingRef.current = true;
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }

      // Check if clicking directly on a stroke
      const clickedStroke = strokesRef.current.slice().reverse().find((st) =>
        st.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < st.width * 2.5 + 6)
      );

      if (clickedStroke) {
        setSelectedStrokeIds([clickedStroke.id]);
        if (!e.shiftKey) setSelectedShapeIds([]);
        isTranslatingRef.current = true;
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }

      // If clicked empty space: start drag-box selection
      isBoxSelectingRef.current = true;
      boxSelectStartRef.current = { x: point.x, y: point.y };
      setBoxSelectRect({ x: point.x, y: point.y, w: 0, h: 0 });
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      return;
    }

    // 4. LASSO TOOL BEHAVIOR
    if (tool === 'lasso') {
      setIsLassoing(true);
      setLassoPoints([point]);
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      return;
    }

    // 5. TEXT / STICKY TOOL
    if (tool === 'text' || tool === 'sticky') {
      setEditingTextElement({
        x: point.x,
        y: point.y,
        text: '',
        isSticky: tool === 'sticky',
      });
      return;
    }

    // 6. ERASER TOOL
    if (tool === 'eraser') {
      const remainingStrokes = strokesRef.current.filter((st) => {
        const hasNearPoint = st.points.some(
          (p) => Math.hypot(p.x - point.x, p.y - point.y) < strokeWidth * 2.5
        );
        return !hasNearPoint;
      });
      setStrokes(remainingStrokes);
      strokesRef.current = remainingStrokes;

      const remainingShapes = shapesRef.current.filter((sh) => {
        const w = sh.width || 120;
        const h = sh.height || 80;
        return !(point.x >= sh.x && point.x <= sh.x + w && point.y >= sh.y && point.y <= sh.y + h);
      });
      setShapes(remainingShapes);
      shapesRef.current = remainingShapes;

      saveCanvasData(remainingStrokes, remainingShapes);
      return;
    }

    // 7. PEN / BRUSH / FOUNTAIN / PENCIL DRAWING (No accidental dragging!)
    isDrawingRef.current = true;
    activePointsRef.current = [point];
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
      return;
    }

    const point = getCanvasCoords(e);

    // Handle Active Rotation Drag
    if (isRotatingRef.current) {
      const bounds = getSelectionBounds();
      if (bounds) {
        const currAngleRad = Math.atan2(point.y - bounds.cy, point.x - bounds.cx);
        const dAngleRad = currAngleRad - lastAngleRadRef.current;
        lastAngleRadRef.current = currAngleRad;
        rotateSelectedItems(dAngleRad, bounds.cx, bounds.cy);
      }
      return;
    }

    // Handle Active Translation Drag
    if (isTranslatingRef.current) {
      const dx = point.x - lastPointerRef.current.x;
      const dy = point.y - lastPointerRef.current.y;
      lastPointerRef.current = { x: point.x, y: point.y };
      translateSelectedItems(dx, dy);
      return;
    }

    // Handle Cursor Drag Box Selection
    if (isBoxSelectingRef.current) {
      const start = boxSelectStartRef.current;
      const minX = Math.min(start.x, point.x);
      const minY = Math.min(start.y, point.y);
      const w = Math.abs(point.x - start.x);
      const h = Math.abs(point.y - start.y);
      setBoxSelectRect({ x: minX, y: minY, w, h });
      return;
    }

    // Handle Lasso Trail
    if (isLassoing) {
      setLassoPoints((prev) => [...prev, point]);
      return;
    }

    // Handle Instant Pointer Drawing
    if (isDrawingRef.current) {
      activePointsRef.current.push(point);
    }
  };

  // Pointer Up Handler
  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      saveCanvasData(strokesRef.current, shapesRef.current);
      return;
    }

    if (isTranslatingRef.current) {
      isTranslatingRef.current = false;
      saveCanvasData(strokesRef.current, shapesRef.current);
      return;
    }

    // Complete Cursor Drag Box Selection
    if (isBoxSelectingRef.current) {
      isBoxSelectingRef.current = false;
      if (boxSelectRect) {
        const { x, y, w, h } = boxSelectRect;
        if (w > 5 && h > 5) {
          const selStrokes = strokesRef.current.filter((st) =>
            st.points.some((p) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h)
          );
          const selShapes = shapesRef.current.filter((sh) => {
            const sw = sh.width || 120;
            const shh = sh.height || 80;
            return sh.x >= x && sh.x + sw <= x + w && sh.y >= y && sh.y + shh <= y + h;
          });

          setSelectedStrokeIds(selStrokes.map((s) => s.id));
          setSelectedShapeIds(selShapes.map((s) => s.id));
        }
      }
      setBoxSelectRect(null);
      return;
    }

    // Complete Lasso Selection
    if (isLassoing) {
      setIsLassoing(false);
      if (lassoPoints.length > 3) {
        const minX = Math.min(...lassoPoints.map((p) => p.x));
        const maxX = Math.max(...lassoPoints.map((p) => p.x));
        const minY = Math.min(...lassoPoints.map((p) => p.y));
        const maxY = Math.max(...lassoPoints.map((p) => p.y));

        const selectedSt = strokesRef.current.filter((st) =>
          st.points.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
        );
        const selectedSh = shapesRef.current.filter((sh) => {
          const sw = sh.width || 120;
          const shh = sh.height || 80;
          return sh.x >= minX && sh.x + sw <= maxX && sh.y >= minY && sh.y + shh <= maxY;
        });

        setSelectedStrokeIds(selectedSt.map((s) => s.id));
        setSelectedShapeIds(selectedSh.map((s) => s.id));
      }
      setLassoPoints([]);
      return;
    }

    // Complete Instant Pointer Stroke
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      const rawPoints = activePointsRef.current;
      activePointsRef.current = [];

      if (rawPoints.length > 1) {
        let processedPoints = filterJitter(rawPoints, tabletSettings.smoothingStrength);

        if (handwritingMode === 2) {
          processedPoints = beautifyPreservingStyle(processedPoints);
        } else if (handwritingMode === 3) {
          processedPoints = convertToElegantScript({
            id: '',
            tool,
            color,
            width: strokeWidth,
            opacity,
            points: processedPoints,
          });
        }

        const smoothedPoints = catmullRomSmooth(processedPoints, 4);

        const newStroke: Stroke = {
          id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tool,
          color,
          width: strokeWidth,
          opacity,
          points: processedPoints,
          smoothedPoints,
          handwritingMode,
        };

        const updatedStrokes = [...strokesRef.current, newStroke];
        setStrokes(updatedStrokes);
        strokesRef.current = updatedStrokes;
        saveCanvasData(updatedStrokes, shapesRef.current);

        const feedback = analyzeHandwritingQuality(updatedStrokes, activeTemplate || undefined);
        if (onFeedbackUpdate) onFeedbackUpdate(feedback);
      }
    }
  };

  // Double Click Text Editor
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldX = (clientX - panX) / zoom;
    const worldY = (clientY - panY) / zoom;

    const clickedText = shapesRef.current.find(
      (sh) =>
        (sh.type === 'text' || sh.type === 'sticky') &&
        worldX >= sh.x - 10 &&
        worldX <= sh.x + (sh.width || 180) &&
        worldY >= sh.y - 20 &&
        worldY <= sh.y + (sh.height || 120)
    );

    if (clickedText) {
      setEditingTextElement({
        id: clickedText.id,
        x: clickedText.x,
        y: clickedText.y,
        text: clickedText.text || '',
        isSticky: clickedText.type === 'sticky',
      });
    }
  };

  // Zoom Helpers - Wheel scrolling zooms in/out the page only
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;

    setZoom((prevZoom) => {
      const newZoom = Math.max(0.2, Math.min(10.0, prevZoom * zoomFactor));

      const worldX = (mouseX - panX) / prevZoom;
      const worldY = (mouseY - panY) / prevZoom;

      setPanX(mouseX - worldX * newZoom);
      setPanY(mouseY - worldY * newZoom);

      return newZoom;
    });
  };

  const handleSaveTextElement = () => {
    if (!editingTextElement || !editingTextElement.text.trim()) {
      setEditingTextElement(null);
      return;
    }

    if (editingTextElement.id) {
      const updated = shapesRef.current.map((sh) =>
        sh.id === editingTextElement.id ? { ...sh, text: editingTextElement.text } : sh
      );
      setShapes(updated);
      shapesRef.current = updated;
      saveCanvasData(strokesRef.current, updated);
    } else {
      const newShape: ShapeElement = {
        id: `sh_${Date.now()}`,
        type: editingTextElement.isSticky ? 'sticky' : 'text',
        x: editingTextElement.x,
        y: editingTextElement.y,
        width: editingTextElement.isSticky ? 200 : undefined,
        height: editingTextElement.isSticky ? 130 : undefined,
        text: editingTextElement.text,
        color: editingTextElement.isSticky ? '#1e293b' : color,
        strokeWidth: 1,
        opacity: 1,
      };

      const updated = [...shapesRef.current, newShape];
      setShapes(updated);
      shapesRef.current = updated;
      saveCanvasData(strokesRef.current, updated);
    }

    setEditingTextElement(null);
  };

  const currentSelectionBounds = getSelectionBounds();

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden select-none cursor-crosshair"
      style={{ backgroundColor: theme.editorBg }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full block touch-none"
      />

      {/* FLOATING SELECTION TRANSFORM TOOLBAR (Position & Angle Control) */}
      {currentSelectionBounds && (
        <div
          className="absolute z-30 flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900/95 border border-sky-400 text-white shadow-2xl backdrop-blur-md text-xs animate-fade-in"
          style={{
            left: `${currentSelectionBounds.cx * zoom + panX}px`,
            top: `${Math.max(20, currentSelectionBounds.minY * zoom + panY - 50)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="font-semibold text-sky-400 px-1 border-r border-zinc-700">
            {selectedStrokeIds.length + selectedShapeIds.length} Selected
          </span>

          {/* Position Nudge Buttons */}
          <div className="flex items-center gap-0.5 bg-zinc-800 p-0.5 rounded border border-zinc-700">
            <button
              onClick={() => translateSelectedItems(-5, 0)}
              className="p-1 hover:bg-white/10 rounded"
              title="Nudge Left (← Arrow)"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              onClick={() => translateSelectedItems(5, 0)}
              className="p-1 hover:bg-white/10 rounded"
              title="Nudge Right (→ Arrow)"
            >
              <ArrowRight size={13} />
            </button>
            <button
              onClick={() => translateSelectedItems(0, -5)}
              className="p-1 hover:bg-white/10 rounded"
              title="Nudge Up (↑ Arrow)"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={() => translateSelectedItems(0, 5)}
              className="p-1 hover:bg-white/10 rounded"
              title="Nudge Down (↓ Arrow)"
            >
              <ArrowDown size={13} />
            </button>
          </div>

          {/* Angle Rotation Controls */}
          <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded border border-zinc-700">
            <button
              onClick={() =>
                rotateSelectedItems(
                  (-15 * Math.PI) / 180,
                  currentSelectionBounds.cx,
                  currentSelectionBounds.cy
                )
              }
              className="px-1.5 py-1 hover:bg-white/10 rounded flex items-center gap-1 font-mono text-[11px]"
              title="Rotate Counter-Clockwise 15° (Key: [)"
            >
              <RotateCcw size={13} /> -15°
            </button>
            <button
              onClick={() =>
                rotateSelectedItems(
                  (15 * Math.PI) / 180,
                  currentSelectionBounds.cx,
                  currentSelectionBounds.cy
                )
              }
              className="px-1.5 py-1 hover:bg-white/10 rounded flex items-center gap-1 font-mono text-[11px]"
              title="Rotate Clockwise 15° (Key: ])"
            >
              <RotateCw size={13} /> +15°
            </button>
          </div>

          {/* Beautify Selection */}
          {selectedStrokeIds.length > 0 && onBeautifySelection && (
            <button
              onClick={() => {
                const selected = strokes.filter((s) => selectedStrokeIds.includes(s.id));
                onBeautifySelection(selected);
              }}
              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 font-medium text-[11px]"
            >
              Beautify
            </button>
          )}

          {/* Delete Selection */}
          <button
            onClick={deleteSelectedItems}
            className="p-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white"
            title="Delete Selected Items (Key: Delete)"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* BOTTOM RIGHT VIEWPORT CONTROLS */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 p-1 rounded-lg bg-black/60 border border-white/10 text-white shadow-xl backdrop-blur-md text-xs">
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          className="p-1.5 rounded hover:bg-white/20"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <span className="w-12 text-center font-mono font-semibold">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(10.0, z + 0.1))}
          className="p-1.5 rounded hover:bg-white/20"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPanX(0);
            setPanY(0);
          }}
          className="p-1.5 rounded hover:bg-white/20 text-gray-400 hover:text-white ml-1 border-l border-white/10"
          title="Reset View"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* TEXT / STICKY NOTE EDITING OVERLAY MODAL */}
      {editingTextElement && (
        <div
          className="absolute z-50 p-3 rounded-lg shadow-2xl border bg-zinc-900 border-sky-500 text-white space-y-2 w-64"
          style={{
            left: `${editingTextElement.x * zoom + panX}px`,
            top: `${editingTextElement.y * zoom + panY}px`,
          }}
        >
          <h4 className="font-bold text-xs flex items-center justify-between text-sky-400">
            <span className="flex items-center gap-1">
              {editingTextElement.isSticky ? <StickyNote size={13} /> : <Type size={13} />}
              {editingTextElement.id ? 'Edit Text Element' : 'New Text / Sticky Note'}
            </span>
          </h4>
          <textarea
            value={editingTextElement.text}
            onChange={(e) =>
              setEditingTextElement({ ...editingTextElement, text: e.target.value })
            }
            placeholder="Type text or note..."
            className="w-full h-20 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-white outline-none resize-none"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setEditingTextElement(null)}
              className="px-2 py-1 rounded text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTextElement}
              className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 font-semibold text-xs"
            >
              Save Element
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
