import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface AlertModalMetadataItem {
  label: string;
  value: ReactNode;
}

interface Props {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  metadata?: AlertModalMetadataItem[];
  cancelLabel?: string;
  actionLabel: string;
  variant?: "danger" | "primary";
  onCancel: () => void;
  onAction: () => void;
}

export function AlertModal({
  open,
  eyebrow,
  title,
  description,
  metadata,
  cancelLabel = "Cancel",
  actionLabel,
  variant = "danger",
  onCancel,
  onAction
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop apple-modal-backdrop alertmodal-backdrop"
      onMouseDown={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="apple-alert-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        {eyebrow && <p className="apple-alert-eyebrow">{eyebrow}</p>}
        <h2 id="alert-dialog-title" className="apple-alert-title">
          {title}
        </h2>
        <p className="apple-alert-description">{description}</p>

        {metadata && metadata.length > 0 && (
          <dl className="apple-alert-metadata">
            {metadata.map((item, idx) => (
              <div key={idx} className="apple-alert-meta-row">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="apple-alert-actions">
          <button type="button" className="apple-alert-cancel-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`apple-alert-action-btn ${variant === "danger" ? "is-danger" : "is-primary"}`}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
