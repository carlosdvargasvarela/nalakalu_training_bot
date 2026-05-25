import DocumentLink from "./DocumentLink";
import type { Reference } from "@/lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

export default function MessageBubble({ role, content, references }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {references && references.length > 0 && (
          <div className="mt-2 border-t border-slate-500 pt-2 space-y-1">
            {references.map((ref) => (
              <DocumentLink key={ref.documentId} documentId={ref.documentId} section={ref.section} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
