"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type Car,
} from "@/lib/supabase/types";
import { createLead, type NewLeadState } from "@/app/(admin)/admin/customers/new/actions";

const SOURCES = ["website", "walk_in", "phone", "whatsapp", "referral", "social", "other"];
const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  referral: "Referral",
  social: "Social media",
  other: "Other",
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Create lead"}
    </Button>
  );
}

export function NewLeadForm({
  cars,
}: {
  cars: Pick<Car, "id" | "year" | "make" | "model" | "variant">[];
}) {
  const [state, formAction] = useActionState<NewLeadState, FormData>(createLead, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" required />
        </Field>
        <Field label="Phone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" placeholder="+971..." required />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field label="Status" htmlFor="lead_status">
          <Select id="lead_status" name="lead_status" defaultValue="new">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" htmlFor="lead_source">
          <Select id="lead_source" name="lead_source" defaultValue="">
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Interested in (car)" htmlFor="interested_car_id">
          <Select id="interested_car_id" name="interested_car_id" defaultValue="">
            <option value="">—</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.make} {c.model}
                {c.variant ? ` ${c.variant}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Initial note (optional)" htmlFor="initial_note">
        <Textarea
          id="initial_note"
          name="initial_note"
          rows={3}
          placeholder="What did they say? Budget, trade-in, timing…"
        />
      </Field>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
