import { useEffect, useId, useRef, useState } from "react";

interface Props {
  text: string;
}

export function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={ref} className="info-tooltip">
      <button className="info-tooltip-trigger" type="button" aria-label="Calculation details" aria-expanded={open} aria-controls={tooltipId} onClick={() => setOpen((current) => !current)}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
      {open ? <span id={tooltipId} className="info-tooltip-panel" role="tooltip">{text}</span> : null}
    </span>
  );
}
