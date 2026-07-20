"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";
import { getDocumentPreview, type DocumentPreview } from "@/lib/api";

interface Props {
  documentId: string;
  section: string;
  updatedAt: string;
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Actualizado hoy";
  if (days === 1) return "Actualizado hace 1 día";
  return `Actualizado hace ${days} días`;
}

export default function DocumentLink({ documentId, section, updatedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    try {
      setPreview(await getDocumentPreview(documentId));
    } finally {
      setLoading(false);
    }
  };

  const isPdf = preview?.originalName.toLowerCase().endsWith(".pdf");

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex flex-col items-start w-full text-left px-2 py-1.5 rounded-lg hover:bg-app/50 transition-colors"
      >
        <span className="text-xs text-accent underline">📄 {section}</span>
        <span className="text-[11px] text-muted">{relativeDate(updatedAt)}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-nk-border">
              <h2 className="text-primary font-semibold truncate pr-2">
                {preview?.originalName ?? "Cargando..."}
              </h2>
              <div className="flex items-center gap-1 flex-shrink-0">
                {preview && (
                  <a
                    href={preview.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
                    aria-label="Descargar"
                  >
                    <Download size={18} />
                  </a>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-app">
              {loading && (
                <p className="text-muted text-sm text-center py-8">Cargando documento...</p>
              )}
              {!loading && preview?.previewHtml && (
                <div
                  className="p-4 text-primary leading-relaxed [&_h1]:font-heading [&_h1]:text-lg [&_h2]:font-heading [&_h2]:text-base [&_p]:mb-2 [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside"
                  dangerouslySetInnerHTML={{ __html: preview.previewHtml }}
                />
              )}
              {!loading && !preview?.previewHtml && isPdf && (
                <iframe src={preview!.downloadUrl} className="w-full h-full" title={preview!.originalName} />
              )}
              {!loading && !preview?.previewHtml && !isPdf && (
                <p className="text-muted text-sm text-center py-8">
                  No se puede previsualizar este tipo de archivo. Usá el botón de descarga.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
