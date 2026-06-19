export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-accent-600"
        aria-hidden="true"
      />
      <p className="text-lg font-medium">{label}</p>
    </div>
  );
}
