import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createMcpClient(serverScript: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverScript],
    env: { ...process.env } as Record<string, string>,
  });
  const client = new Client({ name: "nalakalu-gateway", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

let documentsClient: Client | null = null;
let workersClient: Client | null = null;
let adminClient: Client | null = null;

export async function getDocumentsClient(): Promise<Client> {
  if (!documentsClient) {
    const scriptPath = join(__dirname, "../../mcp-documents/dist/index.js");
    documentsClient = await createMcpClient(scriptPath);
  }
  return documentsClient;
}

export async function getWorkersClient(): Promise<Client> {
  if (!workersClient) {
    const scriptPath = join(__dirname, "../../mcp-workers/dist/index.js");
    workersClient = await createMcpClient(scriptPath);
  }
  return workersClient;
}

export async function getAdminClient(): Promise<Client> {
  if (!adminClient) {
    const scriptPath = join(__dirname, "../../mcp-admin/dist/index.js");
    adminClient = await createMcpClient(scriptPath);
  }
  return adminClient;
}
