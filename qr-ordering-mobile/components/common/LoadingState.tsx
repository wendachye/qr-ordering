export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-24 text-gray-500"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent"
        aria-hidden="true"
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
