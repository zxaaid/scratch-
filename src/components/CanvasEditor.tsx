import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  pageAspectRatio = 'a4-landscape',
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

  // Shape Drawing Active Refs
  const isDrawingShapeRef = useRef<boolean>(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<ShapeElement | null>(null);

  // Pressure update throttle ref
  const lastPressureUpdateRef = useRef<number>(0);

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

    // Throttle pressure updates to App.tsx state to avoid forcing full tree re-renders on every mouse pixel move
    const now = Date.now();
    if (onUpdateTabletPressure && now - lastPressureUpdateRef.current > 150) {
      lastPressureUpdateRef.current = now;
      onUpdateTabletPressure(pressure);
    }

    return {
      x: worldX,
      y: worldY,
      pressure: Math.max(0.05, pressure),
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      time: now,
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
    const isDarkTemplate = template === 'dark-ruled' || template === 'dark-grid';
    ctx.fillStyle = isDarkTemplate ? '#1e293b' : '#ffffff';
    ctx.fillRect(paperX, paperY, width, height);

    ctx.strokeStyle = isDarkTemplate ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
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
      ctx.setLineDash([4 / zoom, 4 / zoom]);
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

  // Render Shape or Text or Sticky or Polygon
  const renderShape = (ctx: CanvasRenderingContext2D, shape: ShapeElement) => {
    const isSelected = selectedShapeIds.includes(shape.id);

    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.fillColor || 'transparent';
    ctx.lineWidth = shape.strokeWidth;
    ctx.globalAlpha = shape.opacity;

    if (isSelected) {
      ctx.setLineDash([4 / zoom, 4 / zoom]);
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
      const w = shape.width || 120;
      const h = shape.height || 80;
      ctx.strokeRect(shape.x, shape.y, w, h);
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fillRect(shape.x, shape.y, w, h);
      }
    } else if (shape.type === 'circle') {
      ctx.beginPath();
      const rx = Math.abs(shape.width || 60) / 2;
      const ry = Math.abs(shape.height || 60) / 2;
      const cx = shape.x + rx;
      const cy = shape.y + ry;
      if (ctx.ellipse) {
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, rx, 0, Math.PI * 2);
      }
      ctx.stroke();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill();
      }
    } else if (shape.type === 'polygon') {
      const w = shape.width || 100;
      const h = shape.height || 100;
      ctx.beginPath();
      ctx.moveTo(shape.x + w / 2, shape.y);
      ctx.lineTo(shape.x + w, shape.y + h);
      ctx.lineTo(shape.x, shape.y + h);
      ctx.closePath();
      ctx.stroke();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill();
      }
    } else if (shape.type === 'diamond') {
      const w = shape.width || 100;
      const h = shape.height || 100;
      ctx.beginPath();
      ctx.moveTo(shape.x + w / 2, shape.y);
      ctx.lineTo(shape.x + w, shape.y + h / 2);
      ctx.lineTo(shape.x + w / 2, shape.y + h);
      ctx.lineTo(shape.x, shape.y + h / 2);
      ctx.closePath();
      ctx.stroke();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill();
      }
    } else if (shape.type === 'hexagon') {
      const w = shape.width || 100;
      const h = shape.height || 100;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = cx + rx * Math.cos(angle);
        const y = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill();
      }
    } else if (shape.type === 'star') {
      const w = shape.width || 100;
      const h = shape.height || 100;
      const cx = shape.x + w / 2;
      const cy = shape.y + h / 2;
      const outerR = Math.min(Math.abs(w), Math.abs(h)) / 2;
      const innerR = outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      if (shape.fillColor && shape.fillColor !== 'transparent') {
        ctx.fill();
      }
    } else if (shape.type === 'arrow' || shape.type === 'line') {
      const endX = shape.x + (shape.width || 120);
      const endY = shape.y + (shape.height || 0);

      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (shape.type === 'arrow') {
        const angle = Math.atan2(endY - shape.y, endX - shape.x);
        const headLen = Math.max(10, shape.strokeWidth * 3);
        ctx.fillStyle = shape.color;
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
      ctx.fillRect(shape.x, shape.y, width, height);

      ctx.fillStyle = '#fde047';
      ctx.fillRect(shape.x, shape.y, width, 18);

      ctx.fillStyle = '#1e293b';
      ctx.font = '13px sans-serif';
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

    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
    const isFlexible = pageAspectRatio === 'flexible';

    let pageWidth = pagePreset.width || 1123;
    let pageHeight = pagePreset.height || 794;

    if (isFlexible || pageWidth === 0) {
      pageWidth = Math.max(300, (width - 48) / zoom);
      pageHeight = Math.max(300, (height - 48) / zoom);
    }

    const paperX = 0;
    const paperY = 0;

    // LAYER 1: A4 Paper Card Drop Shadow & Crisp Paper Canvas
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(paperX + 6 / zoom, paperY + 6 / zoom, pageWidth, pageHeight);

    const isDarkTemplate = page?.template === 'dark-ruled' || page?.template === 'dark-grid';
    ctx.fillStyle = isDarkTemplate ? '#1e293b' : '#ffffff';
    ctx.fillRect(paperX, paperY, pageWidth, pageHeight);
    ctx.restore();

    // Page Border Outline
    ctx.strokeStyle = currentTheme.includes('dark') ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(paperX, paperY, pageWidth, pageHeight);

    // Render Grid Paper Background
    renderBackgroundGrid(ctx, paperX, paperY, pageWidth, pageHeight, page?.template || 'ruled');

    // LAYER 2: Practice Template Guide Background Overlay
    renderTemplateOverlay(ctx, paperX, paperY);

    // LAYER 3: Render Saved Shapes, Text Boxes & Sticky Cards
    shapesRef.current.forEach((s) => renderShape(ctx, s));

    // LAYER 3.5: Render Active Shape Rubberband Preview
    if (activeShapeRef.current) {
      renderShape(ctx, activeShapeRef.current);
    }

    // LAYER 3: Render Saved Strokes
    strokesRef.current.forEach((st) => renderStroke(ctx, st));

    // LAYER 3: Render Active Pointer Stroke (Zero Latency Live Pass)
    const activePts = activePointsRef.current;
    if (isDrawingRef.current && activePts.length > 0) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
      }

      if (activePts.length === 1) {
        ctx.beginPath();
        ctx.arc(activePts[0].x, activePts[0].y, strokeWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < activePts.length; i++) {
          const p1 = activePts[i - 1];
          const p2 = activePts[i];
          const segWidth = calculateWidth(
            strokeWidth,
            tool,
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
      }
      ctx.restore();
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

  // Stable RAF Loop to maintain uninterrupted 120 FPS
  const drawCanvasRef = useRef(drawCanvas);
  useEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      if (drawCanvasRef.current) {
        drawCanvasRef.current();
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Helper to center and fit page in container
  const centerAndFitPage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const isFlexible = pageAspectRatio === 'flexible';
    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];

    if (isFlexible) {
      setZoom(1.0);
      setPanX(24);
      setPanY(24);
      return;
    }

    const pWidth = pagePreset.width || 1123;
    const pHeight = pagePreset.height || 794;

    const fitZoom = Math.min((w - 32) / pWidth, (h - 32) / pHeight);
    const targetZoom = Math.max(0.25, Math.min(3.0, fitZoom));

    const targetPanX = Math.round((w - pWidth * targetZoom) / 2);
    const targetPanY = Math.round((h - pHeight * targetZoom) / 2);

    setZoom(targetZoom);
    setPanX(targetPanX);
    setPanY(targetPanY);
  }, [pageAspectRatio]);

  // Center page on select or aspect ratio change
  useEffect(() => {
    centerAndFitPage();
  }, [page?.id, pageAspectRatio, centerAndFitPage]);

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
          centerAndFitPage();
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
  }, [centerAndFitPage]);

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

    // 6.5. GEOMETRIC SHAPE TOOL (Drag-to-draw interactive creation)
    if (tool === 'shape') {
      isDrawingShapeRef.current = true;
      shapeStartRef.current = { x: point.x, y: point.y };
      activeShapeRef.current = {
        id: `sh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: selectedShape,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        color,
        strokeWidth,
        opacity,
      };
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      return;
    }

    // 7. PEN / BRUSH / FOUNTAIN / PENCIL DRAWING (No accidental dragging!)
    isDrawingRef.current = true;
    activePointsRef.current = [point];
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const container = containerRef.current;
      if (container) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
        const pWidth = pagePreset.width || 1123;
        const pHeight = pagePreset.height || 794;

        const rawPanX = e.clientX - panStart.x;
        const rawPanY = e.clientY - panStart.y;

        const maxPanX = w - 100;
        const minPanX = -(pWidth * zoom - 100);
        const maxPanY = h - 100;
        const minPanY = -(pHeight * zoom - 100);

        setPanX(Math.min(maxPanX, Math.max(minPanX, rawPanX)));
        setPanY(Math.min(maxPanY, Math.max(minPanY, rawPanY)));
      } else {
        setPanX(e.clientX - panStart.x);
        setPanY(e.clientY - panStart.y);
      }
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

    // Handle Active Shape Drag Creation (Rubberband preview)
    if (isDrawingShapeRef.current && shapeStartRef.current && activeShapeRef.current) {
      const startX = shapeStartRef.current.x;
      const startY = shapeStartRef.current.y;
      const rawW = point.x - startX;
      const rawH = point.y - startY;

      if (selectedShape === 'line' || selectedShape === 'arrow') {
        activeShapeRef.current = {
          ...activeShapeRef.current,
          x: startX,
          y: startY,
          width: rawW,
          height: rawH,
        };
      } else {
        activeShapeRef.current = {
          ...activeShapeRef.current,
          x: Math.min(startX, point.x),
          y: Math.min(startY, point.y),
          width: Math.abs(rawW),
          height: Math.abs(rawH),
        };
      }
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

    // Complete Shape Drawing Creation
    if (isDrawingShapeRef.current && activeShapeRef.current) {
      isDrawingShapeRef.current = false;
      const finishedShape = activeShapeRef.current;
      activeShapeRef.current = null;
      shapeStartRef.current = null;

      if (Math.abs(finishedShape.width || 0) > 3 || Math.abs(finishedShape.height || 0) > 3) {
        const updatedShapes = [...shapesRef.current, finishedShape];
        setShapes(updatedShapes);
        shapesRef.current = updatedShapes;
        saveCanvasData(strokesRef.current, updatedShapes);
      }
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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
    const pWidth = pagePreset.width || 1123;
    const pHeight = pagePreset.height || 794;

    const fitZoom = Math.min((container.clientWidth - 48) / pWidth, (container.clientHeight - 48) / pHeight);
    const minZoom = Math.max(0.35, Math.min(fitZoom, 0.95));
    const maxZoom = 4.0;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;

    setZoom((prevZoom) => {
      const newZoom = Math.max(minZoom, Math.min(maxZoom, prevZoom * zoomFactor));

      const worldX = (mouseX - panX) / prevZoom;
      const worldY = (mouseY - panY) / prevZoom;

      let targetPanX = mouseX - worldX * newZoom;
      let targetPanY = mouseY - worldY * newZoom;

      if (newZoom <= minZoom + 0.01) {
        targetPanX = Math.round((container.clientWidth - pWidth * newZoom) / 2);
        targetPanY = Math.round((container.clientHeight - pHeight * newZoom) / 2);
      } else {
        const maxPanX = container.clientWidth - 100;
        const minPanX = -(pWidth * newZoom - 100);
        const maxPanY = container.clientHeight - 100;
        const minPanY = -(pHeight * newZoom - 100);
        targetPanX = Math.min(maxPanX, Math.max(minPanX, targetPanX));
        targetPanY = Math.min(maxPanY, Math.max(minPanY, targetPanY));
      }

      setPanX(targetPanX);
      setPanY(targetPanY);

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

  // Custom Dot Cursor SVG Generator (Precise Dot Pointer instead of cross)
  const dotCursorStyle = useMemo(() => {
    if (tool === 'cursor') return 'default';
    if (tool === 'eraser') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="rgba(244,63,94,0.25)" stroke="%23f43f5e" stroke-width="1.5"/><circle cx="10" cy="10" r="2.5" fill="%23f43f5e"/></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 10 10, pointer`;
    }
    
    // Dynamic Dot matching active ink color and stroke thickness
    const dotRadius = Math.max(3.5, Math.min(8, strokeWidth * 1.1));
    const size = Math.max(18, Math.ceil(dotRadius * 3));
    const center = Math.floor(size / 2);
    const strokeHex = (color || '#1a1a2e').replace('#', '%23');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${dotRadius}" fill="${strokeHex}" stroke="%23ffffff" stroke-width="1.5"/><circle cx="${center}" cy="${center}" r="${Math.max(1, dotRadius - 2.5)}" fill="%23ffffff" opacity="0.85"/></svg>`;
    return `url('data:image/svg+xml;utf8,${svg}') ${center} ${center}, crosshair`;
  }, [tool, color, strokeWidth]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden select-none"
      style={{ backgroundColor: theme.editorBg, cursor: dotCursorStyle }}
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
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 p-1 rounded-lg bg-black/75 border border-white/15 text-white shadow-2xl backdrop-blur-md text-xs z-30">
        <button
          onClick={() => {
            const container = containerRef.current;
            if (!container) return;
            const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
            const pWidth = pagePreset.width || 1123;
            const pHeight = pagePreset.height || 794;
            const fitZoom = Math.min((container.clientWidth - 48) / pWidth, (container.clientHeight - 48) / pHeight);
            const minZ = Math.max(0.35, Math.min(fitZoom, 0.95));
            setZoom((z) => Math.max(minZ, z - 0.1));
          }}
          className="p-1.5 rounded hover:bg-white/20 text-gray-200 hover:text-white transition-colors cursor-pointer"
          title="Zoom Out (Stops at Perfect A4 Size)"
        >
          <ZoomOut size={15} />
        </button>

        <button
          onClick={centerAndFitPage}
          className="px-2 py-1 font-mono font-semibold text-sky-400 hover:text-sky-300 hover:bg-white/10 rounded cursor-pointer transition-all"
          title="Click to Reset & Center A4 Page"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={() => setZoom((z) => Math.min(4.0, z + 0.1))}
          className="p-1.5 rounded hover:bg-white/20 text-gray-200 hover:text-white transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>

        <div className="h-4 w-[1px] bg-white/20 mx-0.5" />

        <button
          onClick={centerAndFitPage}
          className="px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 hover:text-white flex items-center gap-1.5 transition-all text-[11px] font-medium cursor-pointer border border-sky-500/40"
          title="Center & Fit Perfect A4 Page on Screen"
        >
          <FileText size={14} />
          Center Page
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
