import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DocumentLink from "./DocumentLink";
import StepChecklist from "./StepChecklist";
import type { Reference } from "@/lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
  textLarge?: boolean;
}

export default function MessageBubble({ role, content, references, textLarge }: Props) {
  const isUser = role === "user";
  const textClass = textLarge ? "text-lg" : "text-base";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${textClass} leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <StepChecklist>{children}</StepChecklist>,
              li: ({ children }) => <>{children}</>,
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-1 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-200 mb-1 mt-2 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="bg-slate-800 text-slate-200 rounded px-1 py-0.5 text-sm font-mono">{children}</code>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-400 pl-3 italic text-slate-300 mb-2">{children}</blockquote>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
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
