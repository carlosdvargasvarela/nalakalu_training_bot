"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getFavorites, removeFavorite, type Favorite } from "@/lib/localStorage";

interface Props {
  open: boolean;
  onClose: () => void;
  onReask: (question: string) => void;
}

export default function FavoritesDrawer({ open, onClose, onReask }: Props) {
  const [favs, setFavs] = useState<Favorite[]>([]);

  useEffect(() => {
    if (open) setFavs(getFavorites());
  }, [open]);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavs((prev) => prev.filter((f) => f.id !== id));
  };

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
          <h2 className="text-primary font-semibold">Favoritos</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {favs.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              Aún no tienes favoritos. Toca ★ en una respuesta para guardarla.
            </p>
          )}
          {favs.map((f) => (
            <div key={f.id} className="bg-elevated rounded-xl p-3 border border-nk-border/50">
              <p className="text-muted text-xs mb-1">
                {new Date(f.savedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="text-primary text-sm font-medium mb-2">{f.question}</p>
              <p className="text-muted text-xs line-clamp-2 mb-3">{f.answer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onReask(f.question); onClose(); }}
                  className="flex-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg py-1.5 transition-colors"
                >
                  Preguntar de nuevo
                </button>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 rounded-lg px-2 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
