// Small form-field error helper used with react-hook-form across the admin.
export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-sm font-medium text-destructive">{children}</p>;
}
