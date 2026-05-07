"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TestEmailButton } from "@/components/admin/test-email-button";
import {
  updateEmailSender,
  type EmailSenderState,
} from "@/app/(admin)/admin/settings/actions";

type EmailTier = "none" | "shared" | "custom";

function SaveSenderButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save sender"}
    </Button>
  );
}

/** Pulls "bobs-motors" out of "bobs-motors@drivethatcar.app". */
function localPartOf(fullEmail: string | null, platformDomain: string): string {
  if (!fullEmail) return "";
  const at = fullEmail.indexOf("@");
  if (at < 0) return "";
  const local = fullEmail.slice(0, at).toLowerCase();
  const domain = fullEmail.slice(at + 1).toLowerCase();
  return domain === platformDomain.toLowerCase() ? local : "";
}

export function EmailSenderCard({
  emailTier,
  platformSender,
  platformDomain,
  currentResendFromEmail,
}: {
  emailTier: EmailTier;
  platformSender: string;
  platformDomain: string;
  currentResendFromEmail: string | null;
}) {
  const [state, formAction] = useActionState<EmailSenderState, FormData>(
    updateEmailSender,
    {},
  );
  const initialLocalPart = localPartOf(currentResendFromEmail, platformDomain);
  const [localPart, setLocalPart] = useState(initialLocalPart);

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-border bg-bg p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Customer emails</h2>
          <p className="text-sm text-fg-muted">
            Sender for booking confirmations, reminders, cancellations and reschedule
            notices.
          </p>
        </div>
        {emailTier === "custom" && (
          <span className="rounded-full bg-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">
            Pro
          </span>
        )}
      </div>

      {emailTier === "none" && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-subtle p-4 text-sm">
          <p className="text-fg-muted">
            Customer emails aren&rsquo;t included on the Free plan. Customers won&rsquo;t
            get booking confirmations or reminders.
          </p>
          <div>
            <Link
              href="/admin/settings/billing"
              className="inline-flex items-center justify-center rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
            >
              Upgrade to enable
            </Link>
          </div>
        </div>
      )}

      {emailTier === "shared" && (
        <>
          <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-subtle p-4 text-sm">
            <p className="text-fg-muted">
              Sent from{" "}
              <code className="font-mono text-[12px] text-fg">{platformSender}</code> on
              the Starter plan.
            </p>
            <p className="text-xs text-fg-muted">
              Want a custom sender like{" "}
              <code className="font-mono text-[12px]">yourname@{platformDomain}</code>?{" "}
              <Link
                href="/admin/settings/billing"
                className="font-medium text-fg hover:underline"
              >
                Upgrade to Pro
              </Link>
              .
            </p>
          </div>
          <TestEmailButton />
        </>
      )}

      {emailTier === "custom" && (
        <>
          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Sender updated. Click <span className="font-medium">Send test email</span>{" "}
              below to verify it delivers.
            </p>
          )}
          <form action={formAction} className="flex flex-col gap-3">
            <Label htmlFor="email_local_part">Your sender name</Label>
            <SuffixInput
              value={localPart}
              onChange={setLocalPart}
              suffix={`@${platformDomain}`}
            />
            <p className="text-xs text-fg-muted">
              Customer emails will come from{" "}
              <code className="font-mono text-[12px] text-fg">
                {localPart || "yourname"}@{platformDomain}
              </code>
              . 3–32 characters, lowercase letters, numbers, dots and dashes only. Leave
              blank to use the platform default.
            </p>
            <div className="flex justify-end">
              <SaveSenderButton />
            </div>
          </form>
          <hr className="border-border" />
          <TestEmailButton />
        </>
      )}
    </section>
  );
}

/**
 * Single bordered field with the input on the left and a non-editable suffix
 * pinned on the right. The text scrolls horizontally inside the input as the
 * user types past the visible width — same UX you see on Stripe / GitHub /
 * Vercel slug fields.
 */
function SuffixInput({
  value,
  onChange,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-border bg-bg transition-shadow focus-within:border-fg focus-within:ring-2 focus-within:ring-ring">
      <input
        id="email_local_part"
        name="email_local_part"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        placeholder="bobs-motors"
        pattern="^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
        minLength={3}
        maxLength={32}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-fg outline-none placeholder:text-fg-muted"
      />
      <span className="pointer-events-none flex shrink-0 select-none items-center pr-3 text-sm text-fg-muted">
        {suffix}
      </span>
    </div>
  );
}
