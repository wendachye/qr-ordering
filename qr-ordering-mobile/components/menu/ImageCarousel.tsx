"use client";

import { useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";

/**
 * Swipeable image carousel.
 * - Touch devices: native horizontal swipe (CSS scroll-snap).
 * - Desktop: click-and-drag to slide (pointer events) + clickable dots.
 * Renders nothing with no images; a single image shows with no controls.
 */
export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, startScroll: 0, active: false, moved: false });

  if (!images || images.length === 0) return null;

  const updateActive = () => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.max(0, Math.min(images.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Mouse drag-to-slide. Touch is left to the browser's native scroll-snap.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    drag.current = { startX: e.clientX, startScroll: el.scrollLeft, active: true, moved: false };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore (e.g. synthetic pointers) */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const el = trackRef.current;
    if (!el) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Snap to the nearest photo after a mouse drag.
    goTo(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative select-none">
      <div
        ref={trackRef}
        onScroll={updateActive}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        className="flex aspect-[4/3] w-full cursor-grab snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-2xl bg-gray-100 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={assetUrl(src)}
            alt={`${alt} — photo ${i + 1}`}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full shrink-0 snap-center object-cover"
            draggable={false}
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
            {active + 1}/{images.length}
          </div>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full shadow transition-all ${
                  i === active ? "w-5 bg-white" : "w-1.5 bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
