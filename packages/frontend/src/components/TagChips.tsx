interface Props {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagChips({ tags, activeTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="relative bg-surface border-b border-nk-border">
      {/* Fade izquierdo */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-surface to-transparent z-10" />
      {/* Fade derecho */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-surface to-transparent z-10" />

      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
        {tags.map((tag) => {
          const isActive = tag === activeTag;
          return (
            <button
              key={tag}
              onClick={() => onSelect(isActive ? null : tag)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-accent border-accent text-white"
                  : "bg-transparent border-nk-border text-muted hover:bg-elevated hover:text-primary"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
