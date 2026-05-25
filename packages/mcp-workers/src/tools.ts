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
