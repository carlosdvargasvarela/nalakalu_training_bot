"use client";

import { useState, useEffect } from "react";
import { getHistory, type HistoryItem } from "@/lib/localStorage";

interface Props {
  open: boolean;
  onClose: () => void;
  onReask: (question: string) => void;
}

export default function HistoryDrawer({ open, onClose, onReask }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-80 max-w-full bg-slate-800 h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold">Historial</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              No hay preguntas recientes.
            </p>
          )}
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onReask(item.question); onClose(); }}
              className="w-full text-left bg-slate-700 hover:bg-slate-600 rounded-xl p-3 transition-colors"
            >
              <p className="text-white text-sm">{item.question}</p>
              <p className="text-slate-500 text-xs mt-1">
                {new Date(item.askedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
