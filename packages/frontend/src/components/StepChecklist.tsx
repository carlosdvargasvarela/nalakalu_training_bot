"use client";

import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export default function StepChecklist({ children }: Props) {
  const raw = Array.isArray(children) ? children : [children];
  // Filter whitespace text nodes injected by ReactMarkdown between <li> elements
  const items = raw.filter(
    (child) => typeof child !== "string" || child.trim() !== ""
  );

  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(items.length).fill(false)
  );

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const completedCount = checked.filter(Boolean).length;

  return (
    <div className="my-3">
      {items.length > 1 && (
        <p className="text-xs text-muted mb-2">
          {completedCount} / {items.length} pasos completados
        </p>
      )}
      <ol className="space-y-3">
        {items.map((child, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 ${
              checked[i] ? "bg-elevated/40" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={checked[i] ?? false}
              onChange={() => toggle(i)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-nk-border bg-input cursor-pointer accent-accent"
            />
            <div
              className={`leading-relaxed ${
                checked[i] ? "line-through text-muted" : "text-primary"
              }`}
            >
              {child}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
