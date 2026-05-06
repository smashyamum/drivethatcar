"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyCode, type VerifyState } from "./actions";

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Verifying…" : "Verify and continue"}
    </Button>
  );
}

export function VerifyForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<VerifyState, FormData>(verifyCode, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
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
  );
}
