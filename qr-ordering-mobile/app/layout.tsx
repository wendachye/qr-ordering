import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order — QR Ordering",
  description: "Scan, order, and relax. QR-code restaurant ordering.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale — allow pinch-zoom (WCAG 1.4.4) for low-vision diners.
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
