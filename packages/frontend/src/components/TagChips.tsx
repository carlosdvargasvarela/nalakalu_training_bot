interface Props {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagChips({ tags, activeTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 overflow-x-auto scrollbar-hide">
      {tags.map((tag) => {
        const isActive = tag === activeTag;
        return (
          <button
            key={tag}
            onClick={() => onSelect(isActive ? null : tag)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
