import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AbacusQueryResult {
  answer: string;
  references: { documentId: string; section: string }[];
}

interface DocContext {
  id: string;
  original_name: string;
  category: string | null;
  content: string;
}

export async function queryAbacus(
  question: string,
  docs: DocContext[]
): Promise<AbacusQueryResult> {
  if (docs.length === 0) {
    return {
      answer:
        "No encontré procedimientos relacionados con tu consulta. Intenta con otras palabras clave o consulta con tu supervisor.",
      references: [],
    };
  }

  const contextBlocks = docs
    .map(
      (d) =>
        `[${d.original_name}${d.category ? ` — ${d.category}` : ""}]\n${d.content.slice(0, 3000)}`
    )
    .join("\n\n---\n\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Eres el asistente de procedimientos de una empresa de muebles.
Respondes a trabajadores de planta que consultan procedimientos operativos durante su jornada.

REGLAS:
- Responde ÚNICAMENTE con información de los procedimientos proporcionados.
- Si la respuesta no está en los procedimientos, dilo claramente en una sola oración.
- Usa lenguaje sencillo y directo, apropiado para trabajadores de planta.

FORMATO (usa siempre Markdown):
- Pasos numerados con **listas ordenadas** para procedimientos secuenciales.
- **Negrita** para términos clave, advertencias o pasos críticos.
- Listas con viñetas para opciones o elementos sin orden específico.
- Encabezados (##) solo si la respuesta cubre más de un tema distinto.
- Sin introducción innecesaria — ve directo al punto.`,
    messages: [
      {
        role: "user",
        content: `PROCEDIMIENTOS DISPONIBLES:
${contextBlocks}

PREGUNTA: ${question}`,
      },
    ],
  });

  const answer =
    message.content[0].type === "text" ? message.content[0].text : "";

  return {
    answer,
    references: docs.map((d) => ({
      documentId: d.id,
      section: d.original_name,
    })),
  };
}

// Texto ya se guarda en PostgreSQL al ingestar — no se necesita indexación externa
export async function indexDocument(
  docId: string,
  _text: string,
  _filename: string
): Promise<string> {
  return docId;
}
