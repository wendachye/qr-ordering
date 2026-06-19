"use client";

import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// Shared sensors for every menu sortable. A small distance threshold means a
// drag only starts after ~6px of movement, so taps on buttons and vertical
// scroll flings (which begin off the grip handle) are never swallowed — vital
// on iPad. Keyboard sensor keeps reordering accessible.
export function useMenuSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}
