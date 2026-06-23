"use client";

import { useEffect, useRef } from "react";

// Expanded menu-search field, shown in place of the category tabs after the user
// taps the search icon. Auto-focuses; the in-field × clears the text, "Cancel"
// collapses back to the tabs (onClose). The parent filters items while a query
// is set.
export function MenuSearch({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 animate-[searchExpand_180ms_ease-out]">
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-accent focus-within:bg-white">
        <svg
          className="h-4 w-4 shrink-0 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={ref}
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search the menu…"
          aria-label="Search the menu"
          className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-sm font-medium text-accent"
      >
        Cancel
      </button>
    </div>
  );
}
