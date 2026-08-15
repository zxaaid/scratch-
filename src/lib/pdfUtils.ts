import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('PDF.js worker initialization fallback:', e);
  }
}

/**
 * Loads a PDF document from ArrayBuffer, Blob, or URL
 */
export async function loadPdfDocument(source: ArrayBuffer | Blob | string) {
  let data: ArrayBuffer | string;
  if (source instanceof Blob) {
    data = await source.arrayBuffer();
  } else {
    data = source;
  }

  const loadingTask = pdfjsLib.getDocument(
    typeof data === 'string' ? { url: data } : { data: new Uint8Array(data) }
  );
  return await loadingTask.promise;
}

/**
 * Renders a specific page of a PDF document to an HTML Canvas
 */
export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  targetWidth?: number
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; dataUrl: string }> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1.0 });

  const scale = targetWidth ? targetWidth / unscaledViewport.width : 2.0; // High resolution 2x default
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  const dataUrl = canvas.toDataURL('image/png');

  return {
    canvas,
    width: unscaledViewport.width,
    height: unscaledViewport.height,
    dataUrl,
  };
}

/**
 * Converts a PDF file into an array of image data URLs (one per page)
 */
export async function convertPdfToImagePages(file: File | ArrayBuffer): Promise<
  Array<{ pageNumber: number; dataUrl: string; width: number; height: number }>
> {
  const pdfDoc = await loadPdfDocument(file);
  const totalPages = pdfDoc.numPages;
  const results: Array<{ pageNumber: number; dataUrl: string; width: number; height: number }> = [];

  for (let i = 1; i <= totalPages; i++) {
    const pageData = await renderPdfPageToCanvas(pdfDoc, i, 1200);
    results.push({
      pageNumber: i,
      dataUrl: pageData.dataUrl,
      width: pageData.width,
      height: pageData.height,
    });
  }

  return results;
}
