// Resolves stored image urls for display. Uploaded images are stored relative
// (e.g. "/uploads/x.png"); we prefix them with the backend origin (the API base
// URL without its trailing "/api"). Absolute http(s) urls pass through.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export function assetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}
