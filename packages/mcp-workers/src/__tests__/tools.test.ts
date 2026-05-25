import { describe, it, expect, vi } from "vitest";

vi.mock("@nalakalu/db", () => ({
  getDb: () => ({
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "session-abc", worker_id: "EMP-042" }] }),
  }),
}));

import { getSession, identifyWorker } from "../tools.js";

describe("workers-mcp tools", () => {
  it("getSession crea sesión anónima y retorna id", async () => {
    const session = await getSession();
    expect(session.id).toBe("session-abc");
    expect(session.workerId).toBeNull();
  });

  it("identifyWorker asigna número de empleado a la sesión", async () => {
    const session = await identifyWorker("session-abc", "EMP-042");
    expect(session.workerId).toBe("EMP-042");
  });
});
