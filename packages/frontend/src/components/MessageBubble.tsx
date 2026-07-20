"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import DocumentLink from "./DocumentLink";
import StepChecklist from "./StepChecklist";
import type { Reference } from "@/lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
  textLarge?: boolean;
  onFeedback?: (rating: "up" | "down") => void;
  onFavorite?: () => void;
}

export function LoadingBubble() {
  return (
    <div className="flex justify-start mb-3 items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        A
      </div>
      <div className="bg-elevated border border-nk-border/50 shadow-sm text-muted rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  references,
  textLarge,
  onFeedback,
  onFavorite,
}: Props) {
  const isUser = role === "user";
  const textClass = textLarge ? "text-lg" : "text-base";
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [favorited, setFavorited] = useState(false);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start items-end gap-2"} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mb-0.5">
          A
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${textClass} leading-relaxed ${
          isUser
            ? "bg-user-bubble text-white rounded-br-sm"
            : "bg-elevated border border-nk-border/50 shadow-sm text-primary rounded-bl-sm"
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
              em: ({ children }) => <em className="italic text-muted">{children}</em>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <StepChecklist>{children}</StepChecklist>,
              li: ({ children }) => <>{children}</>,
              h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold text-white mb-1 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold text-primary mb-1 mt-2 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="bg-app text-primary rounded px-1 py-0.5 text-sm font-mono">{children}</code>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-nk-border pl-3 italic text-muted mb-2">{children}</blockquote>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {references && references.length > 0 && (
          <div className="mt-2 border-t border-nk-border pt-2 space-y-1">
            {references.map((ref) => (
              <DocumentLink
                key={ref.documentId}
                documentId={ref.documentId}
                section={ref.section}
                updatedAt={ref.updatedAt}
              />
            ))}
          </div>
        )}
        {!isUser && (onFeedback || onFavorite) && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-nk-border/50">
            {onFeedback && (
              <>
                <button
                  onClick={() => {
                    setRated("up");
                    onFeedback("up");
                  }}
                  disabled={rated !== null}
                  className={`p-1 rounded transition-colors ${
                    rated === "up" ? "text-accent" : "text-muted hover:text-primary"
                  }`}
                  aria-label="Respuesta útil"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  onClick={() => {
                    setRated("down");
                    onFeedback("down");
                  }}
                  disabled={rated !== null}
                  className={`p-1 rounded transition-colors ${
                    rated === "down" ? "text-accent" : "text-muted hover:text-primary"
                  }`}
                  aria-label="Respuesta no útil"
                >
                  <ThumbsDown size={14} />
                </button>
              </>
            )}
            {onFavorite && (
              <button
                onClick={() => {
                  setFavorited(true);
                  onFavorite();
                }}
                disabled={favorited}
                className={`flex items-center gap-1 text-xs ml-1 transition-colors ${
                  favorited ? "text-yellow-400" : "text-muted hover:text-yellow-400"
                }`}
              >
                <Star size={14} /> {favorited ? "Guardado" : "Guardar"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
