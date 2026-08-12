export type PenToolType =
  | 'cursor'
  | 'pen'
  | 'fountain'
  | 'pencil'
  | 'marker'
  | 'highlighter'
  | 'brush'
  | 'eraser'
  | 'lasso'
  | 'shape'
  | 'text'
  | 'sticky';

export type ShapeType = 'line' | 'arrow' | 'rectangle' | 'circle' | 'polygon';

export type HandwritingMode = 1 | 2 | 3; // 1: Smoothing only, 2: Beautify style, 3: Script conversion

export type PageAspectRatio =
  | 'flexible'
  | 'a4-portrait'
  | 'a4-landscape'
  | 'letter'
  | 'a3'
  | 'square'
  | 'widescreen';

export interface PageAspectPreset {
  id: PageAspectRatio;
  name: string;
  width: number;
  height: number;
  label: string;
}

export type PageTemplate =
  | 'blank'
  | 'ruled'
  | 'grid'
  | 'dot'
  | 'graph'
  | 'dark-ruled'
  | 'dark-grid';

export type ThemeId =
  | 'vscode-dark'
  | 'vscode-light'
  | 'monokai'
  | 'solarized-dark'
  | 'high-contrast';

export interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  time: number;
}

export interface Stroke {
  id: string;
  tool: PenToolType;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  smoothedPoints?: Point[];
  isBeautified?: boolean;
  handwritingMode?: HandwritingMode;
  isSelected?: boolean;
}

export interface ShapeElement {
  id: string;
  type: ShapeType | 'text' | 'sticky';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
  points?: Point[];
  isSelected?: boolean;
  rotation?: number;
}

export interface Page {
  id: string;
  title: string;
  template: PageTemplate;
  strokes: Stroke[];
  shapes: ShapeElement[];
  createdAt: string;
  updatedAt: string;
  isInfinite?: boolean;
  tags?: string[];
  ocrText?: string;
  isFavorite?: boolean;
  aiBeautifiedVersion?: {
    strokes: Stroke[];
    transcript: string;
  };
}

export interface Notebook {
  id: string;
  title: string;
  folderId?: string;
  pages: Page[];
  tags: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  title: string;
  parentFolderId?: string;
  isExpanded?: boolean;
}

export interface PDFAnnotationPage {
  pageNumber: number;
  strokes: Stroke[];
  shapes: ShapeElement[];
}

export interface PDFItem {
  id: string;
  name: string;
  url: string;
  totalPages: number;
  annotations: Record<number, PDFAnnotationPage>;
  tags: string[];
  isFavorite?: boolean;
  uploadedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  folders: Folder[];
  notebooks: Notebook[];
  pdfs: PDFItem[];
}

export interface PenPreset {
  id: string;
  name: string;
  tool: PenToolType;
  color: string;
  width: number;
  opacity: number;
  handwritingMode: HandwritingMode;
}

export interface PressureCurve {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

export interface TabletSettings {
  pressureSensitivity: number; // 0.1 to 2.0
  curve: PressureCurve;
  tiltSensitivity: number;
  palmRejection: boolean;
  smoothingStrength: number; // 0 (none) to 1 (max)
  predictionLatencyMs: number; // e.g. 10ms stroke prediction
  snapShapes: boolean;
}

export interface HandwritingFeedback {
  score: number; // 0-100
  baselineConsistency: number; // %
  sizeConsistency: number; // %
  slantAngle: number; // degrees
  spacingUniformity: number; // %
  avgHeight: number; // px
  strokeCount: number;
  feedbackTips: string[];
  analyzedAt: string;
}

export interface PracticeTemplate {
  id: string;
  title: string;
  category: 'Cursive' | 'Print' | 'Calligraphy' | 'Math' | 'Custom';
  referenceText: string;
  description: string;
}

export interface TabItem {
  id: string;
  type: 'page' | 'pdf';
  notebookId?: string;
  pageId?: string;
  pdfId?: string;
  title: string;
  isDirty?: boolean;
}

export type ActivityTab = 'explorer' | 'pdfs' | 'search' | 'ai' | 'settings' | 'practice';

export interface CommandPaletteAction {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon?: string;
  run: () => void;
}
