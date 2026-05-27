"use client";

import { useState, useEffect } from "react";
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-80 max-w-full bg-slate-800 h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-white font-semibold">Favoritos</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {favs.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              Aún no tienes favoritos. Toca ★ en una respuesta para guardarla.
            </p>
          )}
          {favs.map((f) => (
            <div key={f.id} className="bg-slate-700 rounded-xl p-3">
              <p className="text-slate-300 text-xs mb-1">
                {new Date(f.savedAt).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="text-white text-sm font-medium mb-2">{f.question}</p>
              <p className="text-slate-300 text-xs line-clamp-2 mb-3">{f.answer}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onReask(f.question); onClose(); }}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-1.5"
                >
                  Preguntar de nuevo
                </button>
                <button
                  onClick={() => handleRemove(f.id)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800 rounded-lg px-2"
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
