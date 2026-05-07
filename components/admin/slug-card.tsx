"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgSlug, type SlugState } from "@/app/(admin)/admin/settings/actions";

function SaveSlugButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Update address"}
    </Button>
  );
}

export function SlugCard({
  currentSlug,
  isPro,
  siteUrl,
}: {
  currentSlug: string;
  isPro: boolean;
  siteUrl: string;
}) {
  const [state, formAction] = useActionState<SlugState, FormData>(updateOrgSlug, {});
  const [draft, setDraft] = useState(currentSlug);
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-border bg-bg p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Public booking page address</h2>
          <p className="text-sm text-fg-muted">
            The URL you share with customers to view your stock and book viewings.
          </p>
        </div>
        {!isPro && (
          <span className="rounded-full bg-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">
            Pro
          </span>
        )}
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Address updated. Old links no longer work — share the new one with customers.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <Label htmlFor="slug">Address</Label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-l-md border border-r-0 border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
            {host}/d/
          </span>
          <Input
            id="slug"
            name="slug"
            defaultValue={currentSlug}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!isPro}
            className="flex-1 rounded-l-none"
            placeholder="my-motors"
          />
        </div>
        {isPro ? (
          <p className="text-xs text-fg-muted">
            Lowercase letters, numbers and dashes. 3–120 characters. New URL:{" "}
            <span className="font-mono text-fg">
              {host}/d/{draft || currentSlug}
            </span>
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            Custom addresses are a Pro feature.{" "}
            <Link href="/admin/settings/billing" className="font-medium text-fg hover:underline">
              Upgrade to Pro
            </Link>{" "}
            to choose your own.
          </p>
        )}
        {isPro && (
          <div className="flex justify-end">
            <SaveSlugButton />
          </div>
        )}
      </form>
    </section>
  );
}
