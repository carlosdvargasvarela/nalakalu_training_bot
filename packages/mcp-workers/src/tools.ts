import { getDb } from "@nalakalu/db";

export interface WorkerSession {
  id: string;
  workerId: string | null;
}

const db = getDb();

export async function getSession(): Promise<WorkerSession> {
  const { rows } = await db.query<{ id: string; worker_id: string | null }>(
    "INSERT INTO sessions DEFAULT VALUES RETURNING id, worker_id"
  );
  return { id: rows[0].id, workerId: rows[0].worker_id };
}

export async function identifyWorker(
  sessionId: string,
  workerNumber: string
): Promise<WorkerSession> {
  const { rows } = await db.query<{ id: string; worker_id: string }>(
    "UPDATE sessions SET worker_id = $1 WHERE id = $2 RETURNING id, worker_id",
    [workerNumber, sessionId]
  );
  if (!rows[0]) throw new Error(`Sesión ${sessionId} no encontrada`);
  return { id: rows[0].id, workerId: rows[0].worker_id };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await db.query(
    "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)",
    [sessionId, role, content]
  );
}

export async function getHistory(sessionId: string, limit = 6): Promise<ChatMessage[]> {
  const { rows } = await db.query<{ role: "user" | "assistant"; content: string }>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return rows.reverse();
}
