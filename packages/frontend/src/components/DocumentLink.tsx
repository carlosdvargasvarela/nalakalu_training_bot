"use client";

import { getDocumentUrl } from "@/lib/api";

interface Props {
  documentId: string;
  section: string;
}

export default function DocumentLink({ documentId, section }: Props) {
  const handleOpen = async () => {
    const url = await getDocumentUrl(documentId);
    window.open(url, "_blank");
  };

  return (
    <button
      onClick={handleOpen}
      className="text-xs text-blue-300 underline hover:text-blue-200 text-left"
    >
      📄 {section}
    </button>
  );
}
