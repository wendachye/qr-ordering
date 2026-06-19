"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, X } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// Multiple-select combobox (shadcn "Multiple" pattern): selected values render
// as removable chips INSIDE the input; typing filters a dropdown of suggestions
// (with a check on selected ones) and offers to create a custom value. Built on
// cmdk so the list supports keyboard navigation. Reused for item tags and
// payment methods.
export function MultiCombobox({
  value,
  onChange,
  suggestions,
  max = 8,
  maxLen = 24,
  placeholder = "Select or add…",
  createLabel = (q: string) => `Create “${q}”`,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  max?: number;
  maxLen?: number;
  placeholder?: string;
  createLabel?: (query: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const has = (v: string) => value.some((x) => x.toLowerCase() === v.toLowerCase());
  const atMax = value.length >= max;

  const add = (raw: string) => {
    const v = raw.trim().slice(0, maxLen);
    if (!v || has(v) || atMax) return;
    onChange([...value, v]);
    setQuery("");
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const q = query.trim();
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(q.toLowerCase()));
  const canCreate =
    q.length > 0 &&
    !atMax &&
    !suggestions.some((s) => s.toLowerCase() === q.toLowerCase()) &&
    !has(q);
  const showList = open && (filtered.length > 0 || canCreate);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
    if (e.key === "," && q) {
      e.preventDefault();
      add(q);
    }
  };

  return (
    <Command shouldFilter={false} className="overflow-visible bg-transparent">
      {/* The "input": chips + a borderless text field, in one bordered box. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/30"
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-700"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => remove(t)}
              className="text-slate-400 transition-colors hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <CommandPrimitive.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          disabled={atMax}
          placeholder={atMax ? `Maximum ${max}` : value.length ? "" : placeholder}
          className="ml-1 min-w-[6rem] flex-1 bg-transparent py-0.5 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Dropdown */}
      <div className="relative">
        {showList && (
          <div className="absolute top-1.5 z-50 w-full rounded-xl border border-slate-200 bg-white shadow-md outline-none animate-in fade-in-0 zoom-in-95">
            <CommandList>
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem
                    key={s}
                    value={s}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => (has(s) ? remove(s) : add(s))}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", has(s) ? "opacity-100" : "opacity-0")}
                    />
                    {s}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    value={`create-${q}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => add(q)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {createLabel(q)}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </div>
        )}
      </div>
    </Command>
  );
}
