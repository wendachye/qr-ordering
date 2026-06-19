import * as React from "react";

/**
 * Centered, mobile-first container. Caps content width on larger screens and
 * provides optional sticky header + footer slots.
 */
export function MobileShell({
  header,
  footer,
  children,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col bg-white shadow-sm">
      {header && (
        <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
          {header}
        </header>
      )}
      <main className="flex-1">{children}</main>
      {footer && (
        <footer className="sticky bottom-0 z-20 border-t border-gray-100 bg-white">
          {footer}
        </footer>
      )}
    </div>
  );
}
