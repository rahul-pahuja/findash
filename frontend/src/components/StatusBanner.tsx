interface Props {
  kind: "info" | "error" | "success";
  message: string;
  onDismiss?: () => void;
}

export function StatusBanner({ kind, message, onDismiss }: Props) {
  return (
    <div className={`status-toast is-${kind}`} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"}>
      <span className="status-toast-mark" aria-hidden="true" />
      <p>{message}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message">
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
