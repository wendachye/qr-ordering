"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// shadcn Sonner toaster — the app-wide toast surface. `richColors` gives the
// success/error/info variants their tinted backgrounds (matching the old custom
// toast's green/red/slate), and it sits bottom-right like the previous one.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl text-base font-medium shadow-lg",
        },
      }}
      {...props}
    />
  );
}
