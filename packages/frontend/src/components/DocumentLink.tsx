"use client";

import { getDocumentUrl } from "@/lib/api";

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
  const handleOpen = async () => {
    const url = await getDocumentUrl(documentId);
    window.open(url, "_blank");
  };

  return (
    <button
      onClick={handleOpen}
      className="flex flex-col items-start w-full text-left px-2 py-1.5 rounded-lg hover:bg-app/50 transition-colors"
    >
      <span className="text-xs text-accent underline">📄 {section}</span>
      <span className="text-[11px] text-muted">{relativeDate(updatedAt)}</span>
    </button>
  );
}
