"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// A single-date picker: a button showing the selected date that opens a calendar
// popover (shadcn pattern). `min`/`max` bound the selectable range.
export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = "Pick a date",
  size = "sm",
  className,
}: {
  value?: Date;
  onChange: (date: Date) => void;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  placeholder?: string;
  size?: "xs" | "sm" | "default";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const matchers: Matcher[] = [];
  if (max) matchers.push({ after: max });
  if (min) matchers.push({ before: min });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size={size}
          disabled={disabled}
          className={cn("justify-start gap-2 font-medium", !value && "text-slate-400", className)}
        >
          <CalendarIcon className="h-4 w-4 opacity-70" />
          {value ? format(value, "d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          disabled={matchers.length ? matchers : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
