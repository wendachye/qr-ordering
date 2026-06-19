// Copy text to the clipboard, returning whether it succeeded.
//
// The async Clipboard API (navigator.clipboard.writeText) is blocked in several
// common situations — non-secure contexts, and embedded iframes without the
// `clipboard-write` permission policy (e.g. a dev preview pane). We try it first,
// then fall back to a hidden-textarea + execCommand("copy"), which works in many
// of those cases (it copies the current selection rather than needing the API).
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy approach below.
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
