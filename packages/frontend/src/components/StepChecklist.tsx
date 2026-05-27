"use client";

import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export default function StepChecklist({ children }: Props) {
  const items = Array.isArray(children) ? children : [children];
  const [checked, setChecked] = useState<boolean[]>(() =>
    new Array(items.length).fill(false)
  );

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  return (
    <ol className="space-y-2 my-2">
      {items.map((child, i) => (
        <li key={i} className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked[i] ?? false}
            onChange={() => toggle(i)}
            className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-500 bg-slate-800 cursor-pointer accent-blue-500"
          />
          <span
            className={`leading-relaxed ${
              checked[i] ? "line-through text-slate-500" : "text-slate-100"
            }`}
          >
            {child}
          </span>
        </li>
      ))}
    </ol>
  );
}
