"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize up to 6 lines (~96px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-3 bg-surface border-t border-nk-border">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Escribe tu pregunta sobre los procedimientos..."
        rows={1}
        className="flex-1 resize-none rounded-xl bg-input text-primary placeholder-muted px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent border border-nk-border focus:border-accent transition-colors disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-11 h-11 flex items-center justify-center bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed active:bg-accent text-white rounded-xl transition-colors flex-shrink-0 self-end"
        aria-label="Enviar mensaje"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
