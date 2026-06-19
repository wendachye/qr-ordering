// Kept for backwards compatibility: `cn` now lives in lib/utils.ts (shadcn
// convention, powered by clsx + tailwind-merge). Re-export so existing
// `@/lib/cn` imports keep working.
export { cn } from "./utils";
