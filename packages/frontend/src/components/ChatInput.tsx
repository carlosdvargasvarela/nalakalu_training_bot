"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 bg-slate-800 border-t border-slate-700">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        placeholder="Escribe tu pregunta sobre los procedimientos..."
        rows={2}
        className="flex-1 resize-none rounded-xl bg-slate-700 text-slate-100 placeholder-slate-400 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed active:bg-blue-700"
      >
        ▶
      </button>
    </div>
  );
}
