"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  sendTestEmail,
  type TestEmailState,
} from "@/app/(admin)/admin/settings/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Sending…" : "Send test email"}
    </Button>
  );
}

export function TestEmailButton() {
  const [state, formAction] = useActionState<TestEmailState, FormData>(
    sendTestEmail,
    {},
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <Submit />
      </form>
      <p className="text-xs text-fg-muted">
        Sends a sample email to your account address so you can confirm it lands in
        the inbox (not spam) before going live.
      </p>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && state.sentTo && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Sent to <span className="font-medium">{state.sentTo}</span> from{" "}
          <span className="font-mono text-[12px]">{state.from}</span>. Check your
          inbox (and spam folder) — should arrive within a minute.
        </p>
      )}
    </div>
  );
}
