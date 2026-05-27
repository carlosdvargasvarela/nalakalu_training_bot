"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-80 max-w-full bg-surface h-full flex flex-col shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-nk-border">
          <h2 className="text-primary font-semibold">Historial</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              No hay preguntas recientes.
            </p>
          )}
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => { onReask(item.question); onClose(); }}
              className="w-full text-left bg-elevated hover:bg-input rounded-xl p-3 transition-colors border border-nk-border/50"
            >
              <p className="text-primary text-sm">{item.question}</p>
              <p className="text-muted text-xs mt-1">
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
