import jsPDF from 'jspdf';
import { Page, Notebook, PDFItem } from '../types';

/**
 * Downloads a single Page canvas as a PNG image file
 */
export const downloadPageAsPng = (page: Page, canvasWidth = 1200, canvasHeight = 900) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  // Draw white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw page grid or ruling background if needed
  if (page.template === 'ruled') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let y = 60; y < canvasHeight; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  } else if (page.template === 'grid') {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasWidth; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
  }

  // Draw strokes
  if (page.strokes && page.strokes.length > 0) {
    page.strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = stroke.opacity ?? 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      stroke.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    });
  }

  // Draw shapes
  if (page.shapes && page.shapes.length > 0) {
    page.shapes.forEach((shape) => {
      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.fillColor || 'transparent';
      ctx.lineWidth = shape.strokeWidth;
      ctx.globalAlpha = shape.opacity ?? 1.0;

      if (shape.type === 'rectangle') {
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === 'circle') {
        const radius = Math.min(shape.width, shape.height) / 2;
        ctx.beginPath();
        ctx.arc(shape.x + radius, shape.y + radius, radius, 0, Math.PI * 2);
        if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // Trigger browser download
  const link = document.createElement('a');
  link.download = `${page.title.replace(/\s+/g, '_')}_page.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Downloads a single Page as a PDF document
 */
export const downloadPageAsPdf = (page: Page, notebookTitle = 'Workspace Document') => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 595, 842, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text(page.title, 40, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Notebook: ${notebookTitle}`, 40, 72);
  doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 40, 88);

  doc.setDrawColor(226, 232, 240);
  doc.line(40, 100, 555, 100);

  // Render OCR text if available
  if (page.ocrText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Handwriting OCR Recognition:', 40, 125);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(page.ocrText, 40, 145, { maxWidth: 515 });
  }

  doc.save(`${page.title.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Downloads an entire Notebook as a multi-page PDF document
 */
export const downloadNotebookAsPdf = (notebook: Notebook) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  notebook.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 595, 842, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`${notebook.title} - Page ${index + 1}: ${page.title}`, 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Last updated: ${new Date(page.updatedAt).toLocaleString()}`, 40, 70);

    doc.setDrawColor(226, 232, 240);
    doc.line(40, 80, 555, 80);

    if (page.ocrText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Text Transcription:', 40, 105);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(page.ocrText, 40, 125, { maxWidth: 515 });
    }
  });

  doc.save(`${notebook.title.replace(/\s+/g, '_')}_Notebook.pdf`);
};

/**
 * Downloads selected items (notebooks, pages, or PDFs)
 */
export const downloadSelectedFiles = (
  notebooks: Notebook[],
  selectedItemIds: string[],
  importedPdfs: PDFItem[] = []
) => {
  if (selectedItemIds.length === 0) {
    alert('Please select at least one file or notebook to download.');
    return;
  }

  let downloadedCount = 0;

  // Process selected notebooks
  notebooks.forEach((nb) => {
    if (selectedItemIds.includes(nb.id)) {
      downloadNotebookAsPdf(nb);
      downloadedCount++;
    } else {
      // Check individual selected pages inside notebook
      nb.pages.forEach((page) => {
        if (selectedItemIds.includes(page.id)) {
          downloadPageAsPdf(page, nb.title);
          downloadedCount++;
        }
      });
    }
  });

  // Process selected imported PDFs
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
