"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StageOptionProps = {
  label: string;
  value: string;
};

export type StageBlock = {
  range: string; // e.g., "0-6"
  options: StageOptionProps[];
};

export function StageOptions({
  stage,
  onChange,
  singleSelect = false,
}: {
  stage: StageBlock;
  onChange: (next: StageBlock) => void;
  singleSelect?: boolean;
}) {
  const [custom, setCustom] = useState("");

  const toggleSelect = (value: string) => {
    const idx = stage.options.findIndex(
      (o) => o.value === value || o.value === `*${value}`
    );
    if (idx === -1) return;
    const curr = stage.options[idx];
    const wasSelected = curr.value.startsWith("*");
    const baseVal = wasSelected ? curr.value.slice(1) : curr.value;

    let next = [...stage.options];

    if (singleSelect) {
      // enforce only one selected at a time
      next = next.map((o, i) => {
        const clean = o.value.startsWith("*") ? o.value.slice(1) : o.value;
        if (i === idx) {
          // toggle current
          return { ...o, value: wasSelected ? clean : `*${clean}` };
        }
        // clear any other selected
        return { ...o, value: clean };
      });
    } else {
      // multi-select toggle behavior
      const nextVal = wasSelected ? baseVal : `*${baseVal}`;
      next[idx] = { ...curr, value: nextVal };
    }

    onChange({ ...stage, options: next });
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    onChange({
      ...stage,
      options: [...stage.options, { label: v, value: v }],
    });
    setCustom("");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stage.options.map((opt) => {
          const selected = opt.value.startsWith("*");
          const clean = selected ? opt.value.slice(1) : opt.value;
          return (
            <button
              key={opt.value + opt.label}
              type="button"
              onClick={() => toggleSelect(opt.value)}
              className={cn(
                "rounded border px-3 py-2 text-left text-sm",
                selected ? "border-primary bg-primary/10" : "border-muted"
              )}
            >
              {opt.label || clean}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add your own event..."
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <Button type="button" size="sm" onClick={addCustom}>
          Add option
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: Click an option to select/deselect. Selected options are
        highlighted.
      </p>
    </div>
  );
}

export default StageOptions;
