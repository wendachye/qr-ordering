"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown in the ROOT layout itself, which the
// normal error.tsx can't reach. It replaces the whole document, so the app's
// CSS (Tailwind) isn't loaded here — styles are inline and intentionally minimal.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#f3f4f6",
          color: "#111827",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "20rem" }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h1 style={{ margin: "12px 0 4px", fontSize: "1.125rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "#4b5563" }}>
            Please reload the page to continue.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "#047857",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
