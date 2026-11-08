interface Props {
  kind: "info" | "error" | "success";
  message: string;
  onDismiss?: () => void;
}

export function StatusBanner({ kind, message, onDismiss }: Props) {
  const tone = kind === "error"
    ? "border-rose-500/50 text-rose-600 dark:text-rose-400"
    : kind === "success"
      ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
      : "border-sky-500/50 text-sky-600 dark:text-sky-400";

  return (
    <div className="fixed left-1/2 top-6 z-[60] -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex min-w-[320px] items-center justify-between gap-4 rounded-full border bg-background/60 px-6 py-3 shadow-2xl backdrop-blur-2xl ${tone}`}>
        <p className="text-sm font-bold tracking-tight">{message}</p>
        {onDismiss ? (
          <button
            className="rounded-full bg-muted p-1 hover:bg-secondary transition-colors"
            onClick={onDismiss}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
