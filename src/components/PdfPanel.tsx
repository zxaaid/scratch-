import React from 'react';
import { FileText, Upload, Plus, Download, Tag, StickyNote, Trash2, Eye } from 'lucide-react';
import { PDFItem, PDFAnnotationPage, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface PdfPanelProps {
  pdfs: PDFItem[];
  onUploadPdf: (file: File) => void;
  onSelectPdf: (pdfId: string) => void;
  onDeletePdf: (pdfId: string) => void;
  activePdfId?: string;
  currentTheme: ThemeId;
}

export const PdfPanel: React.FC<PdfPanelProps> = ({
  pdfs,
  onUploadPdf,
  onSelectPdf,
  onDeletePdf,
  activePdfId,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadPdf(e.target.files[0]);
    }
  };

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
        <span>PDF Documents</span>
        <label className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer" title="Upload PDF">
          <Upload size={15} />
          <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {/* PDF List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {pdfs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 space-y-2">
            <FileText size={32} className="mx-auto opacity-40" />
            <p>No PDFs open.</p>
            <p className="text-[10px]">Upload a PDF to annotate & write handwritten notes.</p>
          </div>
        ) : (
          pdfs.map((pdf) => {
            const isActive = activePdfId === pdf.id;
            const annotationCount = Object.values(pdf.annotations || {}).reduce(
              (acc: number, pg: PDFAnnotationPage) => acc + (pg.strokes?.length || 0) + (pg.shapes?.length || 0),
              0
            );

            return (
              <div
                key={pdf.id}
                onClick={() => onSelectPdf(pdf.id)}
                className={`p-2.5 rounded border transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-sky-600/20 border-sky-500 text-sky-100 shadow-sm'
                    : 'bg-black/10 border-white/5 hover:border-white/20 text-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={18} className="text-rose-400 shrink-0" />
                    <span className="font-semibold truncate text-xs">{pdf.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePdf(pdf.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-rose-400"
                    title="Remove PDF"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{pdf.totalPages} Pages</span>
                  <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
                    <StickyNote size={10} className="text-amber-400" />
                    {annotationCount} Annotations
                  </span>
                </div>

                {pdf.tags && pdf.tags.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {pdf.tags.map((t) => (
                      <span key={t} className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
