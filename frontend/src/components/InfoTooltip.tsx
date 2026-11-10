import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  text: string;
  title?: string;
}

export function InfoTooltip({ text, title }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const updatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const margin = 8;
    const viewportPadding = 12;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (left + popoverWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - popoverWidth - viewportPadding;
    }
    left = Math.max(viewportPadding, left);

    let top = rect.bottom + margin;
    const estHeight = 130;
    if (top + estHeight > window.innerHeight - viewportPadding && rect.top - margin - estHeight >= viewportPadding) {
      top = rect.top - margin - estHeight;
    }

    setPopoverStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `min(${popoverWidth}px, calc(100vw - 24px))`,
      zIndex: 280
    });
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => updatePosition();
    const handler = (event: MouseEvent) => {
      if (btnRef.current && btnRef.current.contains(event.target as Node)) return;
      if (popoverRef.current && popoverRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className="info-tooltip info-popover-wrap">
      <button
        ref={btnRef}
        className="info-tooltip-trigger info-trigger-btn"
        type="button"
        aria-label="Calculation details"
        aria-expanded={open}
        aria-controls={tooltipId}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="15" height="15">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              id={tooltipId}
              className="apple-info-popover"
              style={popoverStyle}
              role="tooltip"
            >
              <h4>{title || "How this is calculated"}</h4>
              <p>{text}</p>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
