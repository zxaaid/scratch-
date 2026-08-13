import jsPDF from 'jspdf';
import { Page, Notebook, PDFItem, ThemeId } from '../types';

/**
 * Renders an exact high-resolution visual copy of a Page onto an HTML Canvas
 */
export const renderPageToCanvas = (
  page: Page,
  _currentTheme: ThemeId = 'vscode-dark'
): HTMLCanvasElement => {
  const isDarkTemplate = page.template === 'dark-ruled' || page.template === 'dark-grid';

  let maxX = 794;
  let maxY = 1123;

  if (page.strokes && page.strokes.length > 0) {
    page.strokes.forEach((s) => {
      const pts = s.smoothedPoints || s.points || [];
      pts.forEach((pt) => {
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });
    });
  }

  if (page.shapes && page.shapes.length > 0) {
    page.shapes.forEach((s) => {
      const w = s.width || 100;
      const h = s.height || 100;
      if (s.x + w > maxX) maxX = s.x + w;
      if (s.y + h > maxY) maxY = s.y + h;
    });
  }

  const canvasWidth = Math.ceil(Math.max(794, maxX));
  const canvasHeight = Math.ceil(Math.max(1123, maxY));

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Exact Paper Background Color: Pure white for light paper templates, dark slate for dark templates
  const paperBg = isDarkTemplate ? '#1e293b' : '#ffffff';
  const gridLineColor = isDarkTemplate ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
  const dotColor = isDarkTemplate ? 'rgba(255, 255, 255, 0.25)' : '#cbd5e1';

  // 1. Draw Paper Background
  ctx.fillStyle = paperBg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Draw Template Pattern (Ruled, Grid, Graph, Dot)
  ctx.save();
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 1;

  if (page.template === 'ruled' || page.template === 'dark-ruled') {
    const lineHeight = 36;
    for (let y = 60; y < canvasHeight; y += lineHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
    // Red left margin line
    ctx.strokeStyle = '#f87171';
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.lineTo(70, canvasHeight);
    ctx.stroke();
  } else if (page.template === 'grid' || page.template === 'graph' || page.template === 'dark-grid') {
    const gridSize = page.template === 'graph' ? 16 : 28;
    for (let x = 0; x < canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  } else if (page.template === 'dot') {
    ctx.fillStyle = dotColor;
    const dotSpacing = 28;
    for (let x = 20; x < canvasWidth; x += dotSpacing) {
      for (let y = 20; y < canvasHeight; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // 3. Draw Shapes, Text Boxes & Sticky Notes
  if (page.shapes && page.shapes.length > 0) {
    page.shapes.forEach((shape) => {
      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.fillColor || 'transparent';
      ctx.lineWidth = shape.strokeWidth || 2;
      ctx.globalAlpha = shape.opacity ?? 1.0;

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
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fillRect(shape.x, shape.y, w, h);
        ctx.strokeRect(shape.x, shape.y, w, h);
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
      } else if (shape.type === 'polygon') {
        const w = shape.width || 100;
        const h = shape.height || 100;
        ctx.beginPath();
        ctx.moveTo(shape.x + w / 2, shape.y);
        ctx.lineTo(shape.x + w, shape.y + h);
        ctx.lineTo(shape.x, shape.y + h);
        ctx.closePath();
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'diamond') {
        const w = shape.width || 100;
        const h = shape.height || 100;
        ctx.beginPath();
        ctx.moveTo(shape.x + w / 2, shape.y);
        ctx.lineTo(shape.x + w, shape.y + h / 2);
        ctx.lineTo(shape.x + w / 2, shape.y + h);
        ctx.lineTo(shape.x, shape.y + h / 2);
        ctx.closePath();
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
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
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
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
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'arrow' || shape.type === 'line') {
        const startX = shape.x;
        const startY = shape.y;
        const endX = shape.x + (shape.width || 100);
        const endY = shape.y + (shape.height || 100);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (shape.type === 'arrow') {
          const angle = Math.atan2(endY - startY, endX - startX);
          const headLen = Math.max(12, shape.strokeWidth * 3);
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
    });
  }

  // 4. Draw Handwritten Strokes
  if (page.strokes && page.strokes.length > 0) {
    page.strokes.forEach((stroke) => {
      const pts = stroke.smoothedPoints || stroke.points || [];
      if (pts.length === 0) return;

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity ?? 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
      }

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, Math.max(1, stroke.width / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = stroke.width || 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  return canvas;
};

/**
 * Generates an ArrayBuffer of a Page as a PDF document for direct local disk saving
 */
export const generatePagePdfArrayBuffer = (
  page: Page,
  currentTheme: ThemeId = 'vscode-dark'
): ArrayBuffer => {
  const canvas = renderPageToCanvas(page, currentTheme);
  const imgData = canvas.toDataURL('image/png');

  const isLandscape = canvas.width > canvas.height;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = doc.internal.pageSize.getHeight();

  const imgRatio = canvas.width / canvas.height;
  const pdfRatio = pdfWidth / pdfHeight;

  let renderW = pdfWidth;
  let renderH = pdfHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > pdfRatio) {
    renderH = pdfWidth / imgRatio;
    offsetY = (pdfHeight - renderH) / 2;
  } else {
    renderW = pdfHeight * imgRatio;
    offsetX = (pdfWidth - renderW) / 2;
  }

  doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
  return doc.output('arraybuffer');
};

/**
 * Generates an ArrayBuffer of a full Notebook as a multi-page PDF document for direct local disk saving
 */
export const generateNotebookPdfArrayBuffer = (
  notebook: Notebook,
  currentTheme: ThemeId = 'vscode-dark'
): ArrayBuffer | null => {
  if (!notebook.pages || notebook.pages.length === 0) {
    return null;
  }

  let doc: jsPDF | null = null;

  notebook.pages.forEach((page, index) => {
    const canvas = renderPageToCanvas(page, currentTheme);
    const imgData = canvas.toDataURL('image/png');
    const isLandscape = canvas.width > canvas.height;

    if (index === 0) {
      doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4',
      });
    } else if (doc) {
      doc.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    if (doc) {
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      const imgRatio = canvas.width / canvas.height;
      const pdfRatio = pdfWidth / pdfHeight;

      let renderW = pdfWidth;
      let renderH = pdfHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > pdfRatio) {
        renderH = pdfWidth / imgRatio;
        offsetY = (pdfHeight - renderH) / 2;
      } else {
        renderW = pdfHeight * imgRatio;
        offsetX = (pdfWidth - renderW) / 2;
      }

      doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
    }
  });

  return doc ? doc.output('arraybuffer') : null;
};

/**
 * Downloads a single Page canvas as a PNG image file
 */
export const downloadPageAsPng = (page: Page, currentTheme?: ThemeId) => {
  const canvas = renderPageToCanvas(page, currentTheme);
  const link = document.createElement('a');
  link.download = `${page.title.replace(/[/\\?%*:|"<>]/g, '_')}_page.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Downloads a single Page as an exact high-fidelity PDF document
 */
export const downloadPageAsPdf = (
  page: Page,
  notebookTitle = 'Workspace Document',
  currentTheme?: ThemeId
) => {
  const canvas = renderPageToCanvas(page, currentTheme);
  const imgData = canvas.toDataURL('image/png');

  const isLandscape = canvas.width > canvas.height;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = doc.internal.pageSize.getHeight();

  const imgRatio = canvas.width / canvas.height;
  const pdfRatio = pdfWidth / pdfHeight;

  let renderW = pdfWidth;
  let renderH = pdfHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > pdfRatio) {
    renderH = pdfWidth / imgRatio;
    offsetY = (pdfHeight - renderH) / 2;
  } else {
    renderW = pdfHeight * imgRatio;
    offsetX = (pdfWidth - renderW) / 2;
  }

  doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
  doc.save(`${page.title.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);
};

/**
 * Downloads an entire Notebook as a multi-page PDF document containing exact drawings
 */
export const downloadNotebookAsPdf = (notebook: Notebook, currentTheme?: ThemeId) => {
  if (!notebook.pages || notebook.pages.length === 0) {
    alert('This notebook has no pages to download.');
    return;
  }

  let doc: jsPDF | null = null;

  notebook.pages.forEach((page, index) => {
    const canvas = renderPageToCanvas(page, currentTheme);
    const imgData = canvas.toDataURL('image/png');
    const isLandscape = canvas.width > canvas.height;

    if (index === 0) {
      doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4',
      });
    } else if (doc) {
      doc.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }

    if (doc) {
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      const imgRatio = canvas.width / canvas.height;
      const pdfRatio = pdfWidth / pdfHeight;

      let renderW = pdfWidth;
      let renderH = pdfHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > pdfRatio) {
        renderH = pdfWidth / imgRatio;
        offsetY = (pdfHeight - renderH) / 2;
      } else {
        renderW = pdfHeight * imgRatio;
        offsetX = (pdfWidth - renderW) / 2;
      }

      doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
    }
  });

  if (doc) {
    doc.save(`${notebook.title.replace(/[/\\?%*:|"<>]/g, '_')}_Notebook.pdf`);
  }
};

/**
 * Downloads selected items (notebooks, pages, or PDFs)
 */
export const downloadSelectedFiles = (
  notebooks: Notebook[],
  selectedItemIds: string[],
  importedPdfs: PDFItem[] = [],
  currentTheme?: ThemeId
) => {
  if (selectedItemIds.length === 0) {
    alert('Please select at least one file or notebook to download.');
    return;
  }

  let downloadedCount = 0;

  notebooks.forEach((nb) => {
    if (selectedItemIds.includes(nb.id)) {
      downloadNotebookAsPdf(nb, currentTheme);
      downloadedCount++;
    } else {
      nb.pages.forEach((page) => {
        if (selectedItemIds.includes(page.id)) {
          downloadPageAsPdf(page, nb.title, currentTheme);
          downloadedCount++;
        }
      });
    }
  });

  importedPdfs.forEach((pdf) => {
    if (selectedItemIds.includes(pdf.id)) {
      const link = document.createElement('a');
      link.download = pdf.name;
      link.href = pdf.url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      downloadedCount++;
    }
  });

  if (downloadedCount === 0) {
    alert('No downloadable files matched your selection.');
  }
};

