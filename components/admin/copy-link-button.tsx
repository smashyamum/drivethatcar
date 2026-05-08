"use client";

import { useState } from "react";

/**
 * Click-to-copy chip — used on tables where the dealer wants the public
 * URL on their clipboard (to paste into WhatsApp etc.) more often than
 * they want to navigate to it. Shows a brief "Copied!" tick after a
 * successful copy, then reverts.
 */
export function CopyLinkButton({
  url,
  label,
}: {
  /** Full URL written to the clipboard. */
  url: string;
  /** Visible text inside the chip — usually a short slug. */
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts (rare but possible).
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.left = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Copy ${url}`}
      className={`text-xs transition-colors ${
        copied ? "text-emerald-700" : "text-fg-muted hover:text-fg"
      }`}
    >
      {copied ? "✓ Copied" : `${label} ⧉`}
    </button>
  );
}
