import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Point,
  Stroke,
  VanishingStroke,
  ShapeElement,
  ImageElement,
  ImageCrop,
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
  analyzeHandwritingQuality,
} from '../lib/handwritingEngine';
import { loadPdfDocument, renderPdfPageToCanvas } from '../lib/pdfUtils';
import { THEMES } from '../lib/themes';
import { PAGE_ASPECT_PRESETS } from '../lib/pageDimensions';
import { ImageEditToolbar } from './ImageEditToolbar';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Type,
  StickyNote,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  FileText,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Minimize2,
  Expand,
  Infinity,
  Sparkles,
} from 'lucide-react';

interface CanvasEditorProps {
  page?: Page;
  pdf?: PDFItem;
  pdfPageNum?: number;
  onUpdatePageStrokes?: (
    pageId: string,
    strokes: Stroke[],
    shapes: ShapeElement[],
    images?: ImageElement[]
  ) => void;
  onUpdatePdfAnnotations?: (
    pdfId: string,
    pageNum: number,
    strokes: Stroke[],
    shapes: ShapeElement[],
    images?: ImageElement[]
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
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  isDisappearingInk?: boolean;
  actionsRef?: React.MutableRefObject<CanvasEditorActions | null>;
  onZoomChange?: (zoom: number) => void;
}

export interface CanvasEditorActions {
  zoomIn: () => void;
  zoomOut: () => void;
  centerAndFit: () => void;
  fitWidth: () => void;
  fitFullScreen: () => void;
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
  pageAspectRatio = 'a4-landscape',
  onSetPageAspectRatio,
  isZenMode = false,
  onToggleZenMode,
  isDisappearingInk = false,
  actionsRef,
  onZoomChange,
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

  // Saved Strokes, Shapes & Images in State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);
  const [images, setImages] = useState<ImageElement[]>([]);

  // Refs for zero-latency drawing without React re-renders on pointer move
  const isDrawingRef = useRef<boolean>(false);
  const activePointsRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<ShapeElement[]>([]);
  const imagesRef = useRef<ImageElement[]>([]);
  const vanishingStrokesRef = useRef<VanishingStroke[]>([]);

  // Loaded HTMLImageElement cache map for smooth 60fps canvas rendering
  const loadedImagesMapRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // PDF Page Canvas Cache for PDF Mode
  const pdfCanvasCacheRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  // Shape Drawing Active Refs
  const isDrawingShapeRef = useRef<boolean>(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<ShapeElement | null>(null);

  // Pressure update throttle ref
  const lastPressureUpdateRef = useRef<number>(0);

  // Selection & Transform State
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // Drag & Drop hover feedback
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Cropping State
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState<ImageCrop>({ x: 0, y: 0, width: 1, height: 1 });

  // Lasso State
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const lassoPointsRef = useRef<Point[]>([]);
  const [isLassoing, setIsLassoing] = useState<boolean>(false);

  // Interaction Mode Refs for Dragging/Rotating Selection
  const isRotatingRef = useRef<boolean>(false);
  const isTranslatingRef = useRef<boolean>(false);
  const activeHandleRef = useRef<string | null>(null); // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w', 'rotate', 'crop-nw', etc.
  const activeImageStartRef = useRef<ImageElement | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastAngleRadRef = useRef<number>(0);

  // Spacebar Hand Panning State
  const [isSpacebarDown, setIsSpacebarDown] = useState<boolean>(false);
  const [isDraggingActive, setIsDraggingActive] = useState<boolean>(false);

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

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Load and cache Image objects whenever images list updates
  useEffect(() => {
    images.forEach((imgItem) => {
      if (!loadedImagesMapRef.current.has(imgItem.id) || loadedImagesMapRef.current.get(imgItem.id)?.src !== imgItem.src) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          loadedImagesMapRef.current.set(imgItem.id, img);
        };
        img.src = imgItem.src;
      }
    });
  }, [images]);

  // Sync internal strokes, shapes, and images with page/pdf props
  useEffect(() => {
    if (page) {
      const initialStrokes = page.strokes || [];
      const initialShapes = page.shapes || [];
      const initialImages = page.images || [];
      setStrokes(initialStrokes);
      setShapes(initialShapes);
      setImages(initialImages);
      strokesRef.current = initialStrokes;
      shapesRef.current = initialShapes;
      imagesRef.current = initialImages;

      // Trigger initial handwriting analysis
      const fb = analyzeHandwritingQuality(initialStrokes, activeTemplate || undefined);
      if (onFeedbackUpdate) onFeedbackUpdate(fb);
    } else if (pdf) {
      const pdfAnno = pdf.annotations?.[pdfPageNum];
      const initialStrokes = pdfAnno?.strokes || [];
      const initialShapes = pdfAnno?.shapes || [];
      const initialImages = pdfAnno?.images || [];
      setStrokes(initialStrokes);
      setShapes(initialShapes);
      setImages(initialImages);
      strokesRef.current = initialStrokes;
      shapesRef.current = initialShapes;
      imagesRef.current = initialImages;
    }
  }, [page?.id, page?.updatedAt, pdf?.id, pdfPageNum]);

  // Auto-deselect all elements when switching away from selection tools (Cursor, Hand, Lasso)
  useEffect(() => {
    if (tool !== 'cursor' && tool !== 'hand' && tool !== 'lasso') {
      setSelectedImageId(null);
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      setIsCropping(false);
      isTranslatingRef.current = false;
      isRotatingRef.current = false;
      activeHandleRef.current = null;
      isBoxSelectingRef.current = false;
      setBoxSelectRect(null);
    }
  }, [tool]);

  // Load & Render PDF Page via PDF.js when in PDF mode
  useEffect(() => {
    if (!pdf || !pdf.url) {
      pdfCanvasCacheRef.current = null;
      return;
    }

    let isMounted = true;
    setIsPdfLoading(true);

    const renderPdf = async () => {
      try {
        if (!pdfDocRef.current || (pdfDocRef.current as any)._sourceUrl !== pdf.url) {
          const doc = await loadPdfDocument(pdf.url);
          (doc as any)._sourceUrl = pdf.url;
          pdfDocRef.current = doc;
        }

        const rendered = await renderPdfPageToCanvas(pdfDocRef.current, pdfPageNum, 1600);
        if (isMounted) {
          pdfCanvasCacheRef.current = rendered.canvas;
          setIsPdfLoading(false);
        }
      } catch (err) {
        console.warn('Could not render PDF page with PDF.js:', err);
        if (isMounted) setIsPdfLoading(false);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [pdf?.url, pdfPageNum]);

  // Save Canvas Data to Parent
  const saveCanvasData = useCallback(
    (newStrokes: Stroke[], newShapes: ShapeElement[], newImages: ImageElement[]) => {
      if (page && onUpdatePageStrokes) {
        onUpdatePageStrokes(page.id, newStrokes, newShapes, newImages);
      } else if (pdf && onUpdatePdfAnnotations) {
        onUpdatePdfAnnotations(pdf.id, pdfPageNum, newStrokes, newShapes, newImages);
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

  // Selected Image Element
  const selectedImage = useMemo(() => {
    if (!selectedImageId) return null;
    return images.find((img) => img.id === selectedImageId) || null;
  }, [images, selectedImageId]);

  // Compute Selection Bounding Box (strokes & shapes)
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
      if (selectedStrokeIds.length === 0 && selectedShapeIds.length === 0 && !selectedImageId) return;

      const strokeIdSet = new Set(selectedStrokeIds);
      const shapeIdSet = new Set(selectedShapeIds);

      if (strokeIdSet.size > 0) {
        strokesRef.current = strokesRef.current.map((st) => {
          if (strokeIdSet.has(st.id)) {
            const newPts = st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
            const newSmoothed = st.smoothedPoints?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
            return { ...st, points: newPts, smoothedPoints: newSmoothed };
          }
          return st;
        });
      }

      if (shapeIdSet.size > 0) {
        shapesRef.current = shapesRef.current.map((sh) => {
          if (shapeIdSet.has(sh.id)) {
            const newPts = sh.points?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
            return { ...sh, x: sh.x + dx, y: sh.y + dy, points: newPts };
          }
          return sh;
        });
      }

      if (selectedImageId) {
        imagesRef.current = imagesRef.current.map((img) => {
          if (img.id === selectedImageId && !img.locked) {
            return { ...img, x: img.x + dx, y: img.y + dy };
          }
          return img;
        });
      }
    },
    [selectedStrokeIds, selectedShapeIds, selectedImageId]
  );

  // Rotate Selected Items by dAngleRad around center (cx, cy)
  const rotateSelectedItems = useCallback(
    (dAngleRad: number, cx: number, cy: number) => {
      if (selectedStrokeIds.length === 0 && selectedShapeIds.length === 0 && !selectedImageId) return;

      const strokeIdSet = new Set(selectedStrokeIds);
      const shapeIdSet = new Set(selectedShapeIds);
      const cos = Math.cos(dAngleRad);
      const sin = Math.sin(dAngleRad);

      const rotatePoint = (p: Point): Point => {
        const rx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
        const ry = cy + (p.x - cx) * sin + (p.y - cy) * cos;
        return { ...p, x: rx, y: ry };
      };

      if (strokeIdSet.size > 0) {
        strokesRef.current = strokesRef.current.map((st) => {
          if (strokeIdSet.has(st.id)) {
            const newPts = st.points.map(rotatePoint);
            const newSmoothed = st.smoothedPoints?.map(rotatePoint);
            return { ...st, points: newPts, smoothedPoints: newSmoothed };
          }
          return st;
        });
      }

      const dAngleDeg = (dAngleRad * 180) / Math.PI;

      if (shapeIdSet.size > 0) {
        shapesRef.current = shapesRef.current.map((sh) => {
          if (shapeIdSet.has(sh.id)) {
            const rx = cx + (sh.x - cx) * cos - (sh.y - cy) * sin;
            const ry = cy + (sh.x - cx) * sin + (sh.y - cy) * cos;
            const newPts = sh.points?.map(rotatePoint);
            const newRot = ((sh.rotation || 0) + dAngleDeg) % 360;
            return { ...sh, x: rx, y: ry, rotation: newRot, points: newPts };
          }
          return sh;
        });
      }

      if (selectedImageId) {
        imagesRef.current = imagesRef.current.map((img) => {
          if (img.id === selectedImageId && !img.locked) {
            const newRot = ((img.rotation || 0) + dAngleDeg + 360) % 360;
            return { ...img, rotation: newRot };
          }
          return img;
        });
      }
    },
    [selectedStrokeIds, selectedShapeIds, selectedImageId]
  );

  // Delete Selected Items
  const deleteSelectedItems = useCallback(() => {
    const strokeIdSet = new Set(selectedStrokeIds);
    const shapeIdSet = new Set(selectedShapeIds);

    const remainingStrokes = strokesRef.current.filter((st) => !strokeIdSet.has(st.id));
    const remainingShapes = shapesRef.current.filter((sh) => !shapeIdSet.has(sh.id));
    const remainingImages = imagesRef.current.filter((img) => img.id !== selectedImageId);

    setStrokes(remainingStrokes);
    strokesRef.current = remainingStrokes;
    setShapes(remainingShapes);
    shapesRef.current = remainingShapes;
    setImages(remainingImages);
    imagesRef.current = remainingImages;

    setSelectedStrokeIds([]);
    setSelectedShapeIds([]);
    setSelectedImageId(null);
    setIsCropping(false);

    saveCanvasData(remainingStrokes, remainingShapes, remainingImages);
  }, [selectedStrokeIds, selectedShapeIds, selectedImageId, saveCanvasData]);

  // Update a specific image
  const handleUpdateImage = useCallback(
    (updatedFields: Partial<ImageElement>) => {
      if (!selectedImageId) return;
      const updated = imagesRef.current.map((img) =>
        img.id === selectedImageId ? { ...img, ...updatedFields } : img
      );
      setImages(updated);
      imagesRef.current = updated;
      saveCanvasData(strokesRef.current, shapesRef.current, updated);
    },
    [selectedImageId, saveCanvasData]
  );

  // Duplicate selected image
  const handleDuplicateImage = useCallback(() => {
    if (!selectedImage) return;
    const duplicated: ImageElement = {
      ...selectedImage,
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: selectedImage.x + 30,
      y: selectedImage.y + 30,
    };
    const updated = [...imagesRef.current, duplicated];
    setImages(updated);
    imagesRef.current = updated;
    setSelectedImageId(duplicated.id);
    saveCanvasData(strokesRef.current, shapesRef.current, updated);
  }, [selectedImage, saveCanvasData]);

  // Reorder Image Z-Index (Bring Forward / Send Backward)
  const handleReorderImage = useCallback(
    (direction: 'forward' | 'backward') => {
      if (!selectedImageId) return;
      const index = imagesRef.current.findIndex((img) => img.id === selectedImageId);
      if (index === -1) return;

      const newImages = [...imagesRef.current];
      if (direction === 'forward' && index < newImages.length - 1) {
        const item = newImages.splice(index, 1)[0];
        newImages.splice(index + 1, 0, item);
      } else if (direction === 'backward' && index > 0) {
        const item = newImages.splice(index, 1)[0];
        newImages.splice(index - 1, 0, item);
      }

      setImages(newImages);
      imagesRef.current = newImages;
      saveCanvasData(strokesRef.current, shapesRef.current, newImages);
    },
    [selectedImageId, saveCanvasData]
  );

  // Crop Controls
  const handleToggleCrop = useCallback(() => {
    if (!selectedImage) return;
    if (isCropping) {
      setIsCropping(false);
    } else {
      setIsCropping(true);
      setCropBox(selectedImage.crop || { x: 0, y: 0, width: 1, height: 1 });
    }
  }, [selectedImage, isCropping]);

  const handleApplyCrop = useCallback(() => {
    if (!selectedImage) return;
    handleUpdateImage({ crop: cropBox });
    setIsCropping(false);
  }, [selectedImage, cropBox, handleUpdateImage]);

  const handleCancelCrop = useCallback(() => {
    setIsCropping(false);
  }, []);

  // Helper to insert an ImageElement from DataURL/Blob
  const insertImageOnCanvas = useCallback(
    (dataUrl: string, name = 'Image', srcType: ImageElement['sourceType'] = 'image', initialX?: number, initialY?: number) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        const naturalW = tempImg.naturalWidth || 600;
        const naturalH = tempImg.naturalHeight || 400;

        // Default fit to max 450px width while keeping ratio
        const displayW = Math.min(450, naturalW);
        const displayH = Math.round((displayW / naturalW) * naturalH);

        // Center on canvas viewport if coordinates not specified
        const container = containerRef.current;
        const targetX =
          initialX !== undefined
            ? initialX
            : container
            ? (container.clientWidth / 2 - panX) / zoom - displayW / 2
            : 100;
        const targetY =
          initialY !== undefined
            ? initialY
            : container
            ? (container.clientHeight / 2 - panY) / zoom - displayH / 2
            : 100;

        const newImage: ImageElement = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          src: dataUrl,
          name,
          x: Math.max(10, Math.round(targetX)),
          y: Math.max(10, Math.round(targetY)),
          width: displayW,
          height: displayH,
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          opacity: 1,
          rotation: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          grayscale: 0,
          invert: 0,
          blur: 0,
          sourceType: srcType,
        };

        loadedImagesMapRef.current.set(newImage.id, tempImg);
        const updated = [...imagesRef.current, newImage];
        setImages(updated);
        imagesRef.current = updated;
        setSelectedImageId(newImage.id);
        setSelectedStrokeIds([]);
        setSelectedShapeIds([]);
        saveCanvasData(strokesRef.current, shapesRef.current, updated);
      };
      tempImg.src = dataUrl;
    },
    [panX, panY, zoom, saveCanvasData]
  );

  // Helper to load image from URL (web drag / cross-tab / Google Images / Wikipedia / links)
  const loadImageFromUrlAndInsert = useCallback(
    (url: string, name = 'Web Image', targetX?: number, targetY?: number) => {
      if (url.startsWith('data:image/')) {
        insertImageOnCanvas(url, name, 'image', targetX, targetY);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 600;
          c.height = img.naturalHeight || 400;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = c.toDataURL('image/png');
            insertImageOnCanvas(dataUrl, name, 'image', targetX, targetY);
            return;
          }
        } catch {
          // CORS fallback
        }
        insertImageOnCanvas(url, name, 'image', targetX, targetY);
      };
      img.onerror = () => {
        insertImageOnCanvas(url, name, 'image', targetX, targetY);
      };
      img.src = url;
    },
    [insertImageOnCanvas]
  );

  // File Drop & Paste Listeners
  const handleFileDropOrPaste = useCallback(
    async (files: FileList | File[], dropX?: number, dropY?: number) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const offsetX = dropX !== undefined ? dropX + i * 35 : undefined;
        const offsetY = dropY !== undefined ? dropY + i * 35 : undefined;

        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              insertImageOnCanvas(e.target.result as string, file.name, 'image', offsetX, offsetY);
            }
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          try {
            const pdfDoc = await loadPdfDocument(file);
            const rendered = await renderPdfPageToCanvas(pdfDoc, 1, 1200);
            insertImageOnCanvas(rendered.dataUrl, `${file.name} (Pg 1)`, 'pdf-page', offsetX, offsetY);
          } catch (err) {
            console.warn('Could not extract PDF page as image:', err);
          }
        }
      }
    },
    [insertImageOnCanvas]
  );

  // Universal DataTransfer Processor (Local Files, Web Images, HTML fragments, URLs)
  const handleDataTransferDrop = useCallback(
    async (dataTransfer: DataTransfer, dropX?: number, dropY?: number) => {
      // 1. Files from disk (images & PDFs)
      if (dataTransfer.files && dataTransfer.files.length > 0) {
        await handleFileDropOrPaste(dataTransfer.files, dropX, dropY);
        return;
      }

      // 2. Dragged from webpage (HTML img src or link)
      const htmlData = dataTransfer.getData('text/html');
      if (htmlData) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const imgTags = doc.querySelectorAll('img');
        if (imgTags.length > 0) {
          imgTags.forEach((imgTag, idx) => {
            const src = imgTag.getAttribute('src');
            if (src) {
              const offsetX = dropX !== undefined ? dropX + idx * 35 : undefined;
              const offsetY = dropY !== undefined ? dropY + idx * 35 : undefined;
              loadImageFromUrlAndInsert(src, imgTag.alt || 'Web Image', offsetX, offsetY);
            }
          });
          return;
        }
      }

      // 3. URI List or Plain Text URL (e.g. dragging image link or image URL from browser)
      const uriList = dataTransfer.getData('text/uri-list');
      const plainText = dataTransfer.getData('text/plain');
      const candidateUrls = (uriList || plainText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#'));

      for (let i = 0; i < candidateUrls.length; i++) {
        const url = candidateUrls[i];
        if (
          url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('data:image/') ||
          url.startsWith('blob:')
        ) {
          const offsetX = dropX !== undefined ? dropX + i * 35 : undefined;
          const offsetY = dropY !== undefined ? dropY + i * 35 : undefined;
          loadImageFromUrlAndInsert(url, 'Web Image', offsetX, offsetY);
        }
      }
    },
    [handleFileDropOrPaste, loadImageFromUrlAndInsert]
  );

  // Clipboard Paste Event Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (editingTextElement) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFileDropOrPaste([file]);
            return;
          }
        }
      }

      // Also support pasting image URLs
      const text = e.clipboardData?.getData('text/plain');
      if (text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/'))) {
        if (/\.(png|jpe?g|webp|svg|gif|avif)(\?.*)?$/i.test(text) || text.startsWith('data:image/')) {
          e.preventDefault();
          loadImageFromUrlAndInsert(text.trim(), 'Pasted Image');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [editingTextElement, handleFileDropOrPaste, loadImageFromUrlAndInsert]);

  // Drag and Drop Event Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const dropWorldX = (e.clientX - rect.left - panX) / zoom;
    const dropWorldY = (e.clientY - rect.top - panY) / zoom;

    handleDataTransferDrop(e.dataTransfer, dropWorldX, dropWorldY);
  };

  // Spacebar Hand Panning Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextElement) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacebarDown(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacebarDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingTextElement]);

  // Keyboard Event Listener for Arrow Keys, Rotation, and Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextElement) return;
      if (
        selectedStrokeIds.length === 0 &&
        selectedShapeIds.length === 0 &&
        !selectedImageId
      )
        return;

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
        if (selectedImage) {
          rotateSelectedItems((-15 * Math.PI) / 180, selectedImage.x + selectedImage.width / 2, selectedImage.y + selectedImage.height / 2);
        } else {
          const bounds = getSelectionBounds();
          if (bounds) rotateSelectedItems((-15 * Math.PI) / 180, bounds.cx, bounds.cy);
        }
      } else if (e.key === ']' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (selectedImage) {
          rotateSelectedItems((15 * Math.PI) / 180, selectedImage.x + selectedImage.width / 2, selectedImage.y + selectedImage.height / 2);
        } else {
          const bounds = getSelectionBounds();
          if (bounds) rotateSelectedItems((15 * Math.PI) / 180, bounds.cx, bounds.cy);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedItems();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedStrokeIds([]);
        setSelectedShapeIds([]);
        setSelectedImageId(null);
        setIsCropping(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedStrokeIds,
    selectedShapeIds,
    selectedImageId,
    selectedImage,
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

  // Render Practice Template Overlay
  const renderTemplateOverlay = (ctx: CanvasRenderingContext2D, paperX = 60, paperY = 60) => {
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

  // Render Single Image Element onto Context
  const renderImage = (ctx: CanvasRenderingContext2D, imgElement: ImageElement) => {
    const imgObj = loadedImagesMapRef.current.get(imgElement.id);
    if (!imgObj || !imgObj.complete) return;

    const isSelected = selectedImageId === imgElement.id && (tool === 'cursor' || tool === 'hand' || tool === 'lasso');
    const w = imgElement.width;
    const h = imgElement.height;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = imgElement.opacity ?? 1.0;

    // Apply Transformation (Translation, Rotation, Flip)
    ctx.translate(imgElement.x + w / 2, imgElement.y + h / 2);

    if (imgElement.rotation) {
      ctx.rotate((imgElement.rotation * Math.PI) / 180);
    }

    if (imgElement.flipH || imgElement.flipV) {
      ctx.scale(imgElement.flipH ? -1 : 1, imgElement.flipV ? -1 : 1);
    }

    // Apply Filter String (Brightness, Contrast, Invert, Grayscale, Blur)
    const filters: string[] = [];
    if (imgElement.brightness && imgElement.brightness !== 100) filters.push(`brightness(${imgElement.brightness}%)`);
    if (imgElement.contrast && imgElement.contrast !== 100) filters.push(`contrast(${imgElement.contrast}%)`);
    if (imgElement.saturation && imgElement.saturation !== 100) filters.push(`saturate(${imgElement.saturation}%)`);
    if (imgElement.grayscale && imgElement.grayscale > 0) filters.push(`grayscale(${imgElement.grayscale}%)`);
    if (imgElement.invert && imgElement.invert > 0) filters.push(`invert(${imgElement.invert}%)`);
    if (imgElement.blur && imgElement.blur > 0) filters.push(`blur(${imgElement.blur}px)`);

    if (filters.length > 0 && ctx.filter !== undefined) {
      ctx.filter = filters.join(' ');
    }

    // Draw Image (with Crop or full)
    const effectiveCrop = isSelected && isCropping ? cropBox : imgElement.crop;
    if (effectiveCrop) {
      const natW = imgObj.naturalWidth || w;
      const natH = imgObj.naturalHeight || h;
      const sx = Math.max(0, effectiveCrop.x * natW);
      const sy = Math.max(0, effectiveCrop.y * natH);
      const sw = Math.min(natW - sx, effectiveCrop.width * natW);
      const sh = Math.min(natH - sy, effectiveCrop.height * natH);

      ctx.drawImage(imgObj, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(imgObj, -w / 2, -h / 2, w, h);
    }

    ctx.restore();

    // Draw Selection Outline & Handles for selected image
    if (isSelected) {
      ctx.save();
      ctx.translate(imgElement.x + w / 2, imgElement.y + h / 2);
      if (imgElement.rotation) ctx.rotate((imgElement.rotation * Math.PI) / 180);

      // Bounding Outline
      ctx.strokeStyle = isCropping ? '#38bdf8' : '#0ea5e9';
      ctx.lineWidth = (isCropping ? 2 : 1.5) / zoom;
      ctx.setLineDash(isCropping ? [4 / zoom, 4 / zoom] : []);
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      if (isCropping) {
        // Cropping Handles & Darkened Border
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-w / 2 - 2000, -h / 2 - 2000, 4000, 2000); // Top scrim
        ctx.fillRect(-w / 2 - 2000, h / 2, 4000, 2000); // Bottom scrim
        ctx.fillRect(-w / 2 - 2000, -h / 2, 2000, h); // Left scrim
        ctx.fillRect(w / 2, -h / 2, 2000, h); // Right scrim

        // Crop Corners
        const cropHandles = [
          { x: -w / 2, y: -h / 2 },
          { x: w / 2, y: -h / 2 },
          { x: -w / 2, y: h / 2 },
          { x: w / 2, y: h / 2 },
        ];
        ctx.fillStyle = '#38bdf8';
        cropHandles.forEach((ch) => {
          ctx.fillRect(ch.x - 7 / zoom, ch.y - 7 / zoom, 14 / zoom, 14 / zoom);
        });
      } else {
        // Rotation Handle Stem & Knob
        const rotY = -h / 2 - 24 / zoom;
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, rotY);
        ctx.stroke();

        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.arc(0, rotY, 5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();

        // 8 Transform Resize Handles
        const handles = [
          { x: -w / 2, y: -h / 2 }, // NW
          { x: 0, y: -h / 2 }, // N
          { x: w / 2, y: -h / 2 }, // NE
          { x: w / 2, y: 0 }, // E
          { x: w / 2, y: h / 2 }, // SE
          { x: 0, y: h / 2 }, // S
          { x: -w / 2, y: h / 2 }, // SW
          { x: -w / 2, y: 0 }, // W
        ];

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5 / zoom;

        handles.forEach((h) => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, 4.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.restore();
    }
  };

  // Render Stroke
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

  // Render Shape or Text or Sticky
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
      if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fillRect(shape.x, shape.y, w, h);
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
      if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
    } else if (shape.type === 'sticky') {
      const width = shape.width || 200;
      const height = shape.height || 130;
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(shape.x, shape.y, width, height);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(shape.x, shape.y, width, 18);
      ctx.fillStyle = '#854d0e';
      ctx.font = '10px sans-serif';
      ctx.fillText('Sticky Note', shape.x + 8, shape.y + 13);
      ctx.fillStyle = '#1e293b';
      ctx.font = '13px sans-serif';
      const text = shape.text || '';
      ctx.fillText(text, shape.x + 10, shape.y + 40, width - 20);
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

    // Workspace backdrop
    ctx.fillStyle = theme.editorBg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
    const isFlexible = pageAspectRatio === 'flexible';
    const isInfinite = pageAspectRatio === 'infinite';

    let pageWidth = pagePreset.width || 1123;
    let pageHeight = pagePreset.height || 794;

    if (isFlexible || pageWidth === 0) {
      pageWidth = Math.max(300, width / zoom);
      pageHeight = Math.max(300, height / zoom);
    } else if (isInfinite) {
      pageWidth = Math.max(4500, (width * 3) / zoom);
      pageHeight = Math.max(3200, (height * 3) / zoom);
    }

    const paperX = 0;
    const paperY = 0;

    // LAYER 1: A4 Paper Card Drop Shadow & Paper Canvas
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(paperX + 6 / zoom, paperY + 6 / zoom, pageWidth, pageHeight);

    const isDarkTemplate = page?.template === 'dark-ruled' || page?.template === 'dark-grid';
    ctx.fillStyle = isDarkTemplate ? '#1e293b' : '#ffffff';
    ctx.fillRect(paperX, paperY, pageWidth, pageHeight);
    ctx.restore();

    // PDF Background Rendering (if in PDF mode)
    if (pdf && pdfCanvasCacheRef.current) {
      ctx.drawImage(pdfCanvasCacheRef.current, paperX, paperY, pageWidth, pageHeight);
    } else {
      // Render Grid Paper Background
      renderBackgroundGrid(ctx, paperX, paperY, pageWidth, pageHeight, page?.template || 'blank');
    }

    // Page Border Outline
    ctx.strokeStyle = currentTheme.includes('dark') ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(paperX, paperY, pageWidth, pageHeight);

    // LAYER 2: Practice Template Guide Background Overlay
    renderTemplateOverlay(ctx, paperX, paperY);

    // LAYER 3: Render Images (under strokes & shapes)
    imagesRef.current.forEach((img) => renderImage(ctx, img));

    // LAYER 4: Render Shapes, Text Boxes & Sticky Notes
    shapesRef.current.forEach((s) => renderShape(ctx, s));

    // LAYER 4.5: Render Active Shape Rubberband Preview
    if (activeShapeRef.current) {
      renderShape(ctx, activeShapeRef.current);
    }

    // LAYER 5: Render Saved Strokes
    strokesRef.current.forEach((st) => renderStroke(ctx, st));

    // LAYER 5.5: Render Active Pointer Stroke
    const activePts = activePointsRef.current;
    if (isDrawingRef.current && activePts.length > 0) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isDisappearingInk) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 / zoom;
      }

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

    // LAYER 5.8: Render Vanishing / Blinking Disappearing Strokes
    const currentVanishing = vanishingStrokesRef.current;
    if (currentVanishing.length > 0) {
      const now = performance.now();
      let hasActiveVanishing = false;

      currentVanishing.forEach((vStroke) => {
        const elapsed = now - vStroke.createdAt;
        if (elapsed < vStroke.durationMs) {
          hasActiveVanishing = true;
          const pts = vStroke.smoothedPoints || vStroke.points;
          if (pts.length < 2) return;

          // Blinking pulse calculation (smoothly pulsing brightness/opacity 3-4 times)
          const blinkWave = 0.28 + 0.72 * Math.abs(Math.sin((elapsed / 220) * Math.PI));
          // Fade out during the final 800ms of lifetime
          const fadeFactor = elapsed > vStroke.durationMs - 800
            ? Math.max(0, (vStroke.durationMs - elapsed) / 800)
            : 1.0;
          const currentAlpha = Math.max(0, Math.min(1, vStroke.opacity * blinkWave * fadeFactor));

          ctx.save();
          ctx.strokeStyle = vStroke.color;
          ctx.fillStyle = vStroke.color;
          ctx.globalAlpha = currentAlpha;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Pulsing neon glow aura
          ctx.shadowColor = vStroke.color;
          ctx.shadowBlur = (10 + 8 * blinkWave) / zoom;

          for (let i = 1; i < pts.length; i++) {
            const p1 = pts[i - 1];
            const p2 = pts[i];
            const segWidth = calculateWidth(
              vStroke.width,
              vStroke.tool,
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
        }
      });

      // Prune expired vanishing strokes
      vanishingStrokesRef.current = currentVanishing.filter(
        (vs) => now - vs.createdAt < vs.durationMs
      );

      // Loop animation frame if there are still active vanishing strokes to animate
      if (hasActiveVanishing || vanishingStrokesRef.current.length > 0) {
        requestAnimationFrame(drawCanvas);
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

    // Selection Bounds for strokes/shapes
    const bounds = (tool === 'cursor' || tool === 'hand' || tool === 'lasso') ? getSelectionBounds() : null;
    if (bounds) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

      const handleStemY = bounds.minY - 26 / zoom;
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(bounds.cx, bounds.minY);
      ctx.lineTo(bounds.cx, handleStemY);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(bounds.cx, handleStemY, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [
    panX,
    panY,
    zoom,
    page,
    pdf,
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
    selectedImageId,
    isCropping,
    cropBox,
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

  // Fit Full Screen (Maximum Working Area Edge-to-Edge)
  const fitFullScreenPage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
    if (pageAspectRatio === 'flexible') {
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      return;
    }

    const pWidth = pagePreset.width || 1123;
    const pHeight = pagePreset.height || 794;
    const fitZoom = Math.max(0.25, Math.min(w / pWidth, h / pHeight));

    setZoom(fitZoom);
    setPanX(Math.round((w - pWidth * fitZoom) / 2));
    setPanY(Math.round((h - pHeight * fitZoom) / 2));
  }, [pageAspectRatio]);

  // Fit Page Width
  const fitWidthPage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
    const pWidth = pagePreset.width || 1123;
    const targetZoom = Math.max(0.2, (w - 24) / pWidth);
    setZoom(targetZoom);
    setPanX(12);
  }, [pageAspectRatio]);

  // Sync zoom changes to parent for external toolbars
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(zoom);
    }
  }, [zoom, onZoomChange]);

  // Expose viewport action handlers externally to parent / BottomPageToolbar
  useEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        zoomIn: () => setZoom((z) => Math.min(4.0, z + 0.1)),
        zoomOut: () => {
          const container = containerRef.current;
          if (!container) return;
          const pagePreset = PAGE_ASPECT_PRESETS[pageAspectRatio] || PAGE_ASPECT_PRESETS['a4-landscape'];
          const pWidth = pagePreset.width || 1123;
          const pHeight = pagePreset.height || 794;
          const fitZoom = Math.min((container.clientWidth - 48) / pWidth, (container.clientHeight - 48) / pHeight);
          const minZ = Math.max(0.35, Math.min(fitZoom, 0.95));
          setZoom((z) => Math.max(minZ, z - 0.1));
        },
        centerAndFit: centerAndFitPage,
        fitWidth: fitWidthPage,
        fitFullScreen: fitFullScreenPage,
      };
    }
  }, [actionsRef, pageAspectRatio, centerAndFitPage, fitWidthPage, fitFullScreenPage]);

  // Center page on select or aspect ratio change
  useEffect(() => {
    centerAndFitPage();
  }, [page?.id, pdf?.id, pageAspectRatio, centerAndFitPage]);

  // Container Resize Observer
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
          if (drawCanvasRef.current) drawCanvasRef.current();
        }
      }
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    // Spacebar down, middle click, or Alt+click -> Pan canvas
    if (isSpacebarDown || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setIsDraggingActive(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      return;
    }

    if (e.button !== 0 && e.pointerType !== 'pen') return;

    const point = getCanvasCoords(e);
    const isSelectTool = tool === 'cursor' || tool === 'hand';

    // 1. SELECT TOOLS (CURSOR & HAND): CHECK SELECTED IMAGE RESIZE/ROTATE HANDLES OR BODY
    if (isSelectTool && selectedImage) {
      const img = selectedImage;
      const w = img.width;
      const h = img.height;
      const cx = img.x + w / 2;
      const cy = img.y + h / 2;

      // Transform world point into image local coordinate space
      const cos = Math.cos(-((img.rotation || 0) * Math.PI) / 180);
      const sin = Math.sin(-((img.rotation || 0) * Math.PI) / 180);
      const localX = (point.x - cx) * cos - (point.y - cy) * sin;
      const localY = (point.x - cx) * sin + (point.y - cy) * cos;

      const hitRadius = 12 / zoom;

      // Check Rotation Knob Handle
      const rotY = -h / 2 - 24 / zoom;
      if (!isCropping && Math.hypot(localX - 0, localY - rotY) <= hitRadius) {
        isRotatingRef.current = true;
        setIsDraggingActive(true);
        activeImageStartRef.current = { ...img };
        lastAngleRadRef.current = Math.atan2(point.y - cy, point.x - cx);
        return;
      }

      // Check 8 Sizing Handles
      if (!isCropping) {
        const handleMap = [
          { type: 'nw', x: -w / 2, y: -h / 2 },
          { type: 'n', x: 0, y: -h / 2 },
          { type: 'ne', x: w / 2, y: -h / 2 },
          { type: 'e', x: w / 2, y: 0 },
          { type: 'se', x: w / 2, y: h / 2 },
          { type: 's', x: 0, y: h / 2 },
          { type: 'sw', x: -w / 2, y: h / 2 },
          { type: 'w', x: -w / 2, y: 0 },
        ];

        for (const hm of handleMap) {
          if (Math.hypot(localX - hm.x, localY - hm.y) <= hitRadius) {
            activeHandleRef.current = hm.type;
            setIsDraggingActive(true);
            activeImageStartRef.current = { ...img };
            lastPointerRef.current = { x: point.x, y: point.y };
            return;
          }
        }
      }

      // Check Image Body Grab (for moving / dragging)
      if (
        localX >= -w / 2 &&
        localX <= w / 2 &&
        localY >= -h / 2 &&
        localY <= h / 2
      ) {
        isTranslatingRef.current = true;
        setIsDraggingActive(true);
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }
    }

    // 2. SELECT TOOLS (CURSOR & HAND): CHECK SELECTION ROTATION KNOB OR BOUNDING BOX (FOR STROKES/SHAPES)
    if (isSelectTool) {
      const bounds = getSelectionBounds();
      if (bounds) {
        const knobY = bounds.minY - 26 / zoom;
        const hitRadius = 12 / zoom;
        if (Math.hypot(point.x - bounds.cx, point.y - knobY) <= hitRadius) {
          isRotatingRef.current = true;
          setIsDraggingActive(true);
          lastAngleRadRef.current = Math.atan2(point.y - bounds.cy, point.x - bounds.cx);
          return;
        }

        if (
          point.x >= bounds.minX &&
          point.x <= bounds.maxX &&
          point.y >= bounds.minY &&
          point.y <= bounds.maxY
        ) {
          isTranslatingRef.current = true;
          setIsDraggingActive(true);
          lastPointerRef.current = { x: point.x, y: point.y };
          return;
        }
      }
    }

    // 3. SELECT TOOLS (CURSOR & HAND): Select & Grab Elements directly
    if (isSelectTool) {
      // Check if clicked an Image
      const clickedImage = imagesRef.current.slice().reverse().find((img) => {
        const cx = img.x + img.width / 2;
        const cy = img.y + img.height / 2;
        const cos = Math.cos(-((img.rotation || 0) * Math.PI) / 180);
        const sin = Math.sin(-((img.rotation || 0) * Math.PI) / 180);
        const lx = (point.x - cx) * cos - (point.y - cy) * sin;
        const ly = (point.x - cx) * sin + (point.y - cy) * cos;
        return lx >= -img.width / 2 && lx <= img.width / 2 && ly >= -img.height / 2 && ly <= img.height / 2;
      });

      if (clickedImage) {
        setSelectedImageId(clickedImage.id);
        setSelectedStrokeIds([]);
        setSelectedShapeIds([]);
        isTranslatingRef.current = true;
        setIsDraggingActive(true);
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }

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
        setSelectedImageId(null);
        if (!e.shiftKey) setSelectedStrokeIds([]);
        isTranslatingRef.current = true;
        setIsDraggingActive(true);
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }

      // Check if clicking directly on a stroke
      const clickedStroke = strokesRef.current.slice().reverse().find((st) =>
        st.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < st.width * 2.5 + 8)
      );

      if (clickedStroke) {
        setSelectedStrokeIds([clickedStroke.id]);
        setSelectedImageId(null);
        if (!e.shiftKey) setSelectedShapeIds([]);
        isTranslatingRef.current = true;
        setIsDraggingActive(true);
        lastPointerRef.current = { x: point.x, y: point.y };
        return;
      }

      // If clicked empty space with Hand tool -> Pan the entire canvas & deselect
      if (tool === 'hand') {
        setSelectedImageId(null);
        setSelectedStrokeIds([]);
        setSelectedShapeIds([]);
        setIsCropping(false);
        setIsPanning(true);
        setIsDraggingActive(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
        return;
      }

      // If clicked empty space with Cursor tool -> start drag-box selection
      isBoxSelectingRef.current = true;
      boxSelectStartRef.current = { x: point.x, y: point.y };
      setBoxSelectRect({ x: point.x, y: point.y, w: 0, h: 0 });
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      setSelectedImageId(null);
      setIsCropping(false);
      return;
    }

    // 4. LASSO TOOL BEHAVIOR
    if (tool === 'lasso') {
      const bounds = getSelectionBounds();
      if (bounds) {
        const knobY = bounds.minY - 26 / zoom;
        const hitRadius = 12 / zoom;
        if (Math.hypot(point.x - bounds.cx, point.y - knobY) <= hitRadius) {
          isRotatingRef.current = true;
          setIsDraggingActive(true);
          lastAngleRadRef.current = Math.atan2(point.y - bounds.cy, point.x - bounds.cx);
          return;
        }

        if (
          point.x >= bounds.minX &&
          point.x <= bounds.maxX &&
          point.y >= bounds.minY &&
          point.y <= bounds.maxY
        ) {
          isTranslatingRef.current = true;
          setIsDraggingActive(true);
          lastPointerRef.current = { x: point.x, y: point.y };
          return;
        }
      }

      setIsLassoing(true);
      setIsDraggingActive(true);
      lassoPointsRef.current = [point];
      setLassoPoints([point]);
      setSelectedStrokeIds([]);
      setSelectedShapeIds([]);
      setSelectedImageId(null);
      setIsCropping(false);
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

      saveCanvasData(remainingStrokes, remainingShapes, imagesRef.current);
      return;
    }

    // 6.5. GEOMETRIC SHAPE TOOL
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
      setSelectedImageId(null);
      return;
    }

    // 7. PEN / BRUSH / FOUNTAIN / PENCIL DRAWING
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

    // Handle Active Image Resizing / Handle Drag
    if (activeHandleRef.current && selectedImage && activeImageStartRef.current) {
      const handle = activeHandleRef.current;
      const initial = activeImageStartRef.current;
      const dx = point.x - lastPointerRef.current.x;
      const dy = point.y - lastPointerRef.current.y;

      let newW = initial.width;
      let newH = initial.height;
      let newX = initial.x;
      let newY = initial.y;

      const minDim = 30;

      if (handle === 'se') {
        newW = Math.max(minDim, initial.width + dx);
        if (e.shiftKey && initial.naturalWidth && initial.naturalHeight) {
          newH = Math.round((newW / initial.naturalWidth) * initial.naturalHeight);
        } else {
          newH = Math.max(minDim, initial.height + dy);
        }
      } else if (handle === 'e') {
        newW = Math.max(minDim, initial.width + dx);
      } else if (handle === 's') {
        newH = Math.max(minDim, initial.height + dy);
      } else if (handle === 'nw') {
        const proposedW = initial.width - dx;
        if (proposedW >= minDim) {
          newW = proposedW;
          newX = initial.x + dx;
        }
        const proposedH = initial.height - dy;
        if (proposedH >= minDim) {
          newH = proposedH;
          newY = initial.y + dy;
        }
      } else if (handle === 'ne') {
        newW = Math.max(minDim, initial.width + dx);
        const proposedH = initial.height - dy;
        if (proposedH >= minDim) {
          newH = proposedH;
          newY = initial.y + dy;
        }
      } else if (handle === 'sw') {
        const proposedW = initial.width - dx;
        if (proposedW >= minDim) {
          newW = proposedW;
          newX = initial.x + dx;
        }
        newH = Math.max(minDim, initial.height + dy);
      }

      imagesRef.current = imagesRef.current.map((img) =>
        img.id === selectedImageId ? { ...img, width: newW, height: newH, x: newX, y: newY } : img
      );
      return;
    }

    // Handle Active Rotation Drag
    if (isRotatingRef.current) {
      if (selectedImage) {
        const cx = selectedImage.x + selectedImage.width / 2;
        const cy = selectedImage.y + selectedImage.height / 2;
        const currAngleRad = Math.atan2(point.y - cy, point.x - cx);
        const dAngleRad = currAngleRad - lastAngleRadRef.current;
        lastAngleRadRef.current = currAngleRad;
        rotateSelectedItems(dAngleRad, cx, cy);
      } else {
        const bounds = getSelectionBounds();
        if (bounds) {
          const currAngleRad = Math.atan2(point.y - bounds.cy, point.x - bounds.cx);
          const dAngleRad = currAngleRad - lastAngleRadRef.current;
          lastAngleRadRef.current = currAngleRad;
          rotateSelectedItems(dAngleRad, bounds.cx, bounds.cy);
        }
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

    // Handle Active Shape Drag Creation
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
      lassoPointsRef.current.push(point);
      setLassoPoints((prev) => [...prev, point]);
      return;
    }

    // Handle Instant Pointer Drawing
    if (isDrawingRef.current) {
      activePointsRef.current.push(point);
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    setIsDraggingActive(false);

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (activeHandleRef.current) {
      activeHandleRef.current = null;
      activeImageStartRef.current = null;
      setImages([...imagesRef.current]);
      saveCanvasData(strokesRef.current, shapesRef.current, imagesRef.current);
      return;
    }

    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      setStrokes([...strokesRef.current]);
      setShapes([...shapesRef.current]);
      setImages([...imagesRef.current]);
      saveCanvasData(strokesRef.current, shapesRef.current, imagesRef.current);
      return;
    }

    if (isTranslatingRef.current) {
      isTranslatingRef.current = false;
      setStrokes([...strokesRef.current]);
      setShapes([...shapesRef.current]);
      setImages([...imagesRef.current]);
      saveCanvasData(strokesRef.current, shapesRef.current, imagesRef.current);
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
        saveCanvasData(strokesRef.current, updatedShapes, imagesRef.current);
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
      const pts = lassoPointsRef.current;
      if (pts.length > 2) {
        const minX = Math.min(...pts.map((p) => p.x));
        const maxX = Math.max(...pts.map((p) => p.x));
        const minY = Math.min(...pts.map((p) => p.y));
        const maxY = Math.max(...pts.map((p) => p.y));

        // Accurate ray-casting polygon containment check
        const isPointInPoly = (p: { x: number; y: number }) => {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x;
            const yi = pts[i].y;
            const xj = pts[j].x;
            const yj = pts[j].y;
            const intersect =
              yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
            if (intersect) inside = !inside;
          }
          return inside;
        };

        const selectedSt = strokesRef.current.filter((st) => {
          if (!st.points || st.points.length === 0) return false;
          return (
            st.points.some((p) => isPointInPoly(p)) ||
            st.points.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
          );
        });

        const selectedSh = shapesRef.current.filter((sh) => {
          const sw = sh.width || 120;
          const shh = sh.height || 80;
          const cx = sh.x + sw / 2;
          const cy = sh.y + shh / 2;
          return (
            isPointInPoly({ x: cx, y: cy }) ||
            isPointInPoly({ x: sh.x, y: sh.y }) ||
            (sh.x >= minX && sh.x + sw <= maxX && sh.y >= minY && sh.y + shh <= maxY)
          );
        });

        const selectedImgs = imagesRef.current.filter((img) => {
          const cx = img.x + img.width / 2;
          const cy = img.y + img.height / 2;
          return (
            isPointInPoly({ x: cx, y: cy }) ||
            (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY)
          );
        });

        setSelectedStrokeIds(selectedSt.map((s) => s.id));
        setSelectedShapeIds(selectedSh.map((s) => s.id));
        if (selectedImgs.length > 0) {
          setSelectedImageId(selectedImgs[0].id);
        }
      }
      lassoPointsRef.current = [];
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

        if (isDisappearingInk) {
          // Vanishing Ink Mode: Create a transient stroke that blinks and automatically disappears
          const newVanishingStroke: VanishingStroke = {
            id: `vst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            tool,
            color,
            width: strokeWidth,
            opacity,
            points: processedPoints,
            smoothedPoints,
            createdAt: performance.now(),
            durationMs: 3200, // Blinks for ~3.2 seconds then completely vanishes
          };

          vanishingStrokesRef.current.push(newVanishingStroke);
          requestAnimationFrame(drawCanvas);
        } else {
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
          saveCanvasData(updatedStrokes, shapesRef.current, imagesRef.current);

          const feedback = analyzeHandwritingQuality(updatedStrokes, activeTemplate || undefined);
          if (onFeedbackUpdate) onFeedbackUpdate(feedback);
        }
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

  // Wheel Zoom / Pan
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
      saveCanvasData(strokesRef.current, updated, imagesRef.current);
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
      saveCanvasData(strokesRef.current, updated, imagesRef.current);
    }

    setEditingTextElement(null);
  };

  const currentSelectionBounds = getSelectionBounds();

  // Custom Cursor Style
  const dotCursorStyle = useMemo(() => {
    if (isSpacebarDown || tool === 'hand') {
      return isPanning || isTranslatingRef.current ? 'grabbing' : 'grab';
    }
    if (tool === 'cursor') return 'default';
    if (tool === 'eraser') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="rgba(244,63,94,0.25)" stroke="%23f43f5e" stroke-width="1.5"/><circle cx="10" cy="10" r="2.5" fill="%23f43f5e"/></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') 10 10, pointer`;
    }

    const dotRadius = Math.max(3.5, Math.min(8, strokeWidth * 1.1));
    const size = Math.max(18, Math.ceil(dotRadius * 3));
    const center = Math.floor(size / 2);
    const strokeHex = (color || '#1a1a2e').replace('#', '%23');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${dotRadius}" fill="${strokeHex}" stroke="%23ffffff" stroke-width="1.5"/><circle cx="${center}" cy="${center}" r="${Math.max(1, dotRadius - 2.5)}" fill="%23ffffff" opacity="0.85"/></svg>`;
    return `url('data:image/svg+xml;utf8,${svg}') ${center} ${center}, crosshair`;
  }, [tool, color, strokeWidth, isSpacebarDown, isPanning]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden select-none"
      style={{ backgroundColor: theme.editorBg, cursor: dotCursorStyle }}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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

      {/* DRAG & DROP OVERLAY BANNER */}
      {isDragOver && (
        <div className="absolute inset-0 bg-sky-500/20 backdrop-blur-xs border-2 border-dashed border-sky-400 z-50 flex flex-col items-center justify-center text-white pointer-events-none animate-in fade-in">
          <ImageIcon size={48} className="text-sky-300 animate-bounce mb-2" />
          <h3 className="text-base font-bold">Drop Image or PDF here</h3>
          <p className="text-xs text-sky-200">PNG, JPG, SVG, WebP & PDF supported</p>
        </div>
      )}

      {/* FLOATING IMAGE EDIT TOOLBAR */}
      {selectedImage && (tool === 'cursor' || tool === 'hand' || tool === 'lasso') && !isDraggingActive && !isPanning && (
        <div
          className="absolute z-40"
          style={{
            left: `${(selectedImage.x + selectedImage.width / 2) * zoom + panX}px`,
            top: `${Math.max(16, selectedImage.y * zoom + panY - 60)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <ImageEditToolbar
            image={selectedImage}
            onUpdateImage={handleUpdateImage}
            onDeleteImage={deleteSelectedItems}
            onDuplicateImage={handleDuplicateImage}
            onBringForward={() => handleReorderImage('forward')}
            onSendBackward={() => handleReorderImage('backward')}
            currentTheme={currentTheme}
            isCropping={isCropping}
            onToggleCrop={handleToggleCrop}
            onApplyCrop={handleApplyCrop}
            onCancelCrop={handleCancelCrop}
          />
        </div>
      )}

      {/* FLOATING STROKES & SHAPES SELECTION TRANSFORM TOOLBAR */}
      {currentSelectionBounds && (tool === 'cursor' || tool === 'hand' || tool === 'lasso') && !selectedImage && !isDraggingActive && !isPanning && (
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

          <button
            onClick={deleteSelectedItems}
            className="p-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white"
            title="Delete Selected Items (Key: Delete)"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

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
