const BASE_URL = "https://api.abacus.ai/api/v0";

export interface AbacusQueryResult {
  answer: string;
  references: { documentId: string; section: string }[];
}

export async function queryAbacus(question: string): Promise<AbacusQueryResult> {
  const res = await fetch(`${BASE_URL}/callDeploymentApi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apiKey": process.env.ABACUS_API_KEY!,
    },
    body: JSON.stringify({
      deploymentToken: process.env.ABACUS_DEPLOYMENT_TOKEN,
      deploymentId: process.env.ABACUS_DEPLOYMENT_ID,
      queryData: { question },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbacusAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    answer: data.result.answer ?? data.result.response ?? "",
    references: data.result.references ?? [],
  };
}

export async function indexDocument(docId: string, text: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/upsertDocumentData`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apiKey": process.env.ABACUS_API_KEY!,
    },
    body: JSON.stringify({
      deploymentId: process.env.ABACUS_DEPLOYMENT_ID,
      documentId: docId,
      documentData: { text },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AbacusAI index error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.result.docId as string;
}
