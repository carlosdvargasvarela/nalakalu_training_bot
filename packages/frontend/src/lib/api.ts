const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

export interface Reference {
  documentId: string;
  section: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

export async function sendMessage(
  message: string,
  sessionId: string | null
): Promise<{ answer: string; references: Reference[]; sessionId: string }> {
  const res = await fetch(`${GATEWAY}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) throw new Error("Error al contactar el servidor");
  return res.json();
}

export async function getDocumentUrl(id: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/api/chat/document/${id}`);
  if (!res.ok) throw new Error("Documento no encontrado");
  const data = await res.json();
  return data.downloadUrl;
}
