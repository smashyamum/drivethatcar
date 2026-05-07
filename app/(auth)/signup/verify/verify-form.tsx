"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resendCode,
  verifyCode,
  type ResendState,
  type VerifyState,
} from "./actions";

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Verifying…" : "Verify and continue"}
    </Button>
  );
}

function ResendButton({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || sent}
      className="text-sm font-medium text-fg underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-fg-muted disabled:no-underline"
    >
      {pending ? "Sending…" : sent ? "Code sent — check your inbox" : "Resend code"}
    </button>
  );
}

export function VerifyForm({
  email,
  next,
}: {
  email: string;
  next: string | null;
}) {
  const [verifyState, verifyAction] = useActionState<VerifyState, FormData>(
    verifyCode,
    {},
  );
  const [resendState, resendAction] = useActionState<ResendState, FormData>(
    resendCode,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={verifyAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        {next && <input type="hidden" name="next" value={next} />}
        {verifyState.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {verifyState.error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="token">6-digit code</Label>
          <Input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            minLength={6}
            required
            autoFocus
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
          />
        </div>
        <VerifyButton />
      </form>

      <div className="flex items-center justify-between border-t border-border pt-4 text-sm text-fg-muted">
        <span>Didn&rsquo;t get the code?</span>
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <ResendButton sent={!!resendState.sent} />
        </form>
      </div>
      {resendState.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {resendState.error}
        </p>
      )}
    </div>
  );
}
