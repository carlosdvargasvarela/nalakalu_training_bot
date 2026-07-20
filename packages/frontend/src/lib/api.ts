const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

export interface Reference {
  documentId: string;
  section: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

export async function sendMessage(
  message: string,
  sessionId: string | null,
  tagContext?: string[]
): Promise<{
  answer: string;
  references: Reference[];
  sessionId: string;
  tagFallback: boolean;
}> {
  const res = await fetch(`${GATEWAY}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, tag_context: tagContext }),
  });
  if (!res.ok) throw new Error("Error al contactar el servidor");
  return res.json();
}

export interface DocumentPreview {
  originalName: string;
  downloadUrl: string;
  previewHtml: string | null;
}

export async function getDocumentPreview(id: string): Promise<DocumentPreview> {
  const res = await fetch(`${GATEWAY}/api/chat/document/${id}`);
  if (!res.ok) throw new Error("Documento no encontrado");
  return res.json();
}

export async function fetchTags(): Promise<string[]> {
  try {
    const res = await fetch(`${GATEWAY}/api/chat/tags`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface RecentUpdate {
  id: string;
  originalName: string;
  tags: string[];
  updatedAt: string;
}

export async function fetchRecentUpdates(): Promise<RecentUpdate[]> {
  try {
    const res = await fetch(`${GATEWAY}/api/chat/recent-updates`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function sendFeedback(
  sessionId: string,
  question: string,
  answer: string,
  rating: "up" | "down",
  documentIds: string[]
): Promise<void> {
  try {
    await fetch(`${GATEWAY}/api/chat/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, question, answer, rating, documentIds }),
    });
  } catch {
    // señal opcional — no bloquea la UI si falla la red
  }
}
