import { useState, useRef, useEffect } from "react";

interface Props {
  text: string;
}

export function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted"
        aria-label="More info"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-[70] mb-2 -translate-x-1/2 w-64 animate-in fade-in zoom-in-95 duration-200">
          <div className="glass-glance rounded-lg px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground shadow-xl">
            {text}
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full">
              <div
                className="border-4 border-transparent"
                style={{ borderTopColor: "rgba(255,255,255,0.1)" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
