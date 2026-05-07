"use client";

import { useFormStatus } from "react-dom";

export function ConfirmRemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Remove this teammate? They'll lose access immediately.")) {
          e.preventDefault();
        }
      }}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
