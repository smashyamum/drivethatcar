"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type SignUpState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : label}
    </Button>
  );
}

export function SignupForm({
  lockedEmail,
  next,
}: {
  /** When set (= invite flow), the email field is read-only and the
   *  business-name field is hidden. */
  lockedEmail: string | null;
  /** Where to send the user after they finish signing up + verifying. */
  next: string | null;
}) {
  const [state, formAction] = useActionState<SignUpState, FormData>(signUp, {});
  const isInvite = lockedEmail !== null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {!isInvite && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="business_name">Business name</Label>
          <Input
            id="business_name"
            name="business_name"
            type="text"
            autoComplete="organization"
            required
            placeholder="Acme Motors"
          />
          {state.fieldErrors?.business_name && (
            <p className="text-xs text-red-700">{state.fieldErrors.business_name}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={isInvite}
          defaultValue={lockedEmail ?? undefined}
          placeholder="you@example.com"
          className={isInvite ? "bg-bg-subtle text-fg-muted" : undefined}
        />
        {isInvite && (
          <p className="text-xs text-fg-muted">
            Tied to your invite — must use this address.
          </p>
        )}
        {state.fieldErrors?.email && (
          <p className="text-xs text-red-700">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-red-700">{state.fieldErrors.password}</p>
        )}
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <SubmitButton label={isInvite ? "Create account & accept invite" : "Create account"} />

      <p className="text-center text-xs text-fg-muted">
        Already have an account?{" "}
        <Link
          href={
            next
              ? `/login?next=${encodeURIComponent(next)}`
              : "/login"
          }
          className="font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
