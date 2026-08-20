"use client";
import { useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  className = "btn-secondary",
}: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard blocked; the value is selectable text regardless */
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
