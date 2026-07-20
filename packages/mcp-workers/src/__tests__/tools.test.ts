import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({ query: mockQuery }),
}));

import { getSession, identifyWorker, saveMessage, getHistory } from "../tools.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workers-mcp tools", () => {
  it("getSession crea sesión anónima y retorna id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: null }] });
    const session = await getSession();
    expect(session.id).toBe("session-abc");
    expect(session.workerId).toBeNull();
  });

  it("identifyWorker asigna número de empleado a la sesión", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: "EMP-042" }] });
    const session = await identifyWorker("session-abc", "EMP-042");
    expect(session.workerId).toBe("EMP-042");
  });

  it("saveMessage inserta el mensaje con el rol correcto", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await saveMessage("session-abc", "user", "¿Cómo ensamblo el cajón tipo B?");

    expect(mockQuery).toHaveBeenCalledOnce();
    const sql: string = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];
    expect(sql).toContain("INSERT INTO chat_messages");
    expect(params).toEqual(["session-abc", "user", "¿Cómo ensamblo el cajón tipo B?"]);
  });

  it("getHistory retorna los mensajes en orden cronológico", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { role: "assistant", content: "Respuesta 2" },
        { role: "user", content: "Pregunta 2" },
        { role: "assistant", content: "Respuesta 1" },
        { role: "user", content: "Pregunta 1" },
      ],
    });

    const history = await getHistory("session-abc");

    expect(history[0]).toEqual({ role: "user", content: "Pregunta 1" });
    expect(history[3]).toEqual({ role: "assistant", content: "Respuesta 2" });
  });
});
