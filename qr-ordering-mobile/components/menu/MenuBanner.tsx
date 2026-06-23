"use client";

import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { assetUrl } from "@/lib/assets";

const DEFAULT_TITLE = "Our Menu";
const DEFAULT_SUBTITLE = "Freshly prepared and sent straight to the kitchen.";
const ROTATE_MS = 5000;

/**
 * Hero banner at the top of the menu page: restaurant name, a configurable
 * title + tagline, and the current table. Shows the configured background
 * image(s) with a dark overlay for legibility; with more than one image they
 * cross-fade on a timer (auto-rotating slideshow) and can be swiped or jumped
 * to via dots. Falls back to a dark gradient when no image is set, and respects
 * the user's reduced-motion preference (no auto-advance).
 */
export function MenuBanner({
  storeName,
  tableName,
  imageUrls = [],
  title,
  subtitle,
  logoUrl,
}: {
  storeName: string;
  tableName: string;
  imageUrls?: string[];
  title?: string | null;
  subtitle?: string | null;
  logoUrl?: string | null;
}) {
  const heading = title?.trim() || DEFAULT_TITLE;
  const tagline = subtitle?.trim() || DEFAULT_SUBTITLE;

  const images = imageUrls.filter(Boolean);
  const count = images.length;
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  // Keep the active index in range if the image list changes.
  useEffect(() => {
    setIndex((i) => (count === 0 ? 0 : i % count));
  }, [count]);

  // Auto-rotate — unless there's < 2 images or the user prefers reduced motion.
  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);
  const onTouchStart = (e: ReactTouchEvent<HTMLElement>) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLElement>) => {
    if (touchX.current == null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const hasImage = count > 0;
  const active = count ? index % count : 0;

  return (
    <section
      onTouchStart={hasImage ? onTouchStart : undefined}
      onTouchEnd={hasImage ? onTouchEnd : undefined}
      className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 px-6 py-10 text-center text-white"
    >
      {hasImage ? (
        <>
          {images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${url}-${i}`}
              src={assetUrl(url)}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          {/* Dark overlay so the text stays legible over any photo */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/65" />
        </>
      ) : (
        <>
          {/* subtle accent glow (gradient mode only) */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-accent/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-accent/10 blur-2xl" />
        </>
      )}

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(logoUrl)}
          alt=""
          className="relative mx-auto mb-3 h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-lg"
        />
      )}
      <p className="relative text-xs font-medium uppercase tracking-[0.2em] text-accent-light/90 drop-shadow">
        {storeName}
      </p>
      <h1 className="relative mt-2 text-3xl font-extrabold tracking-tight drop-shadow">
        {heading}
      </h1>
      <p className="relative mx-auto mt-2 max-w-[18rem] text-sm text-gray-200 drop-shadow">
        {tagline}
      </p>
      <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-light" />
        {tableName}
      </span>

      {/* Slideshow dots */}
      {count > 1 && (
        <div className="relative mt-4 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show banner image ${i + 1}`}
              aria-current={i === active}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
