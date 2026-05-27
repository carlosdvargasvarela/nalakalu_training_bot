"use client";

import { Bell, X } from "lucide-react";
import { dismissBannerToday } from "@/lib/localStorage";
import type { RecentUpdate } from "@/lib/api";

interface Props {
  updates: RecentUpdate[];
  onDismiss: () => void;
}

export default function UpdateBanner({ updates, onDismiss }: Props) {
  if (updates.length === 0) return null;

  const names = updates.map((u) => u.originalName).join(", ");
  const label =
    updates.length === 1
      ? `El procedimiento "${names}" fue actualizado hoy`
      : `${updates.length} procedimientos fueron actualizados hoy`;

  const handleDismiss = () => {
    dismissBannerToday();
    onDismiss();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border-b border-amber-600/50 text-amber-200 text-sm">
      <Bell size={14} className="flex-shrink-0 text-amber-400" />
      <span className="flex-1">{label}</span>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded text-amber-400 hover:text-amber-200 transition-colors"
        aria-label="Cerrar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}
