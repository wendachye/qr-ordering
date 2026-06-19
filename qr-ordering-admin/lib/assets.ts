// Resolves stored image urls for display.
// - Absolute http(s) urls are returned unchanged.
// - Relative urls (e.g. "/uploads/x.png") are prefixed with the backend origin,
//   which is API_BASE_URL with any trailing "/api" stripped (e.g. http://localhost:4000).

import { API_BASE_URL } from "./api";

// Backend origin = API base URL without the trailing "/api".
const ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function assetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  // Ensure exactly one slash between origin and the relative path.
  return `${ORIGIN}/${url.replace(/^\/+/, "")}`;
}
