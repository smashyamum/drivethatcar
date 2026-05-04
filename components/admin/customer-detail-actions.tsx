"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type LeadStatus,
} from "@/lib/supabase/types";
import {
  addNote,
  logCall,
  logWhatsApp,
  sendEmail,
  setFollowUp,
  setLeadStatus,
  type ActionState,
} from "@/app/(admin)/admin/customers/[id]/actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "…" : children}
    </Button>
  );
}

export function StatusForm({
  customerId,
  currentStatus,
}: {
  customerId: string;
  currentStatus: LeadStatus;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(setLeadStatus, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <Label htmlFor="status" className="text-xs uppercase tracking-wide text-fg-muted">
        Status
      </Label>
      <Select id="status" name="status" defaultValue={currentStatus} className="w-44">
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
      <Submit>Update</Submit>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function FollowUpForm({
  customerId,
  currentValue,
}: {
  customerId: string;
  currentValue: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(setFollowUp, {});
  // datetime-local needs YYYY-MM-DDTHH:mm with no Z
  const defaultLocal = currentValue
    ? new Date(currentValue).toISOString().slice(0, 16)
    : "";
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <Label htmlFor="date" className="text-xs uppercase tracking-wide text-fg-muted">
        Follow-up
      </Label>
      <Input
        id="date"
        name="date"
        type="datetime-local"
        defaultValue={defaultLocal}
        className="w-56"
      />
      <Submit>Save</Submit>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function NoteForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addNote, {});
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      key={state.ok ? "saved" : "draft"}
    >
      <input type="hidden" name="customerId" value={customerId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      <Textarea
        name="body"
        rows={3}
        placeholder="Add a note — what they said, follow-ups needed, anything useful…"
      />
      <div className="flex justify-end">
        <Submit>Add note</Submit>
      </div>
    </form>
  );
}

export function CallForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(logCall, {});
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Log call
      </Button>
    );
  }
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3"
      key={state.ok ? "saved" : "draft"}
    >
      <input type="hidden" name="customerId" value={customerId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      <Textarea name="body" rows={2} placeholder="What was said? (optional)" />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Submit>Save call</Submit>
      </div>
    </form>
  );
}

export function WhatsAppForm({
  customerId,
  phone,
  customerName,
  businessName,
}: {
  customerId: string;
  phone: string;
  customerName: string;
  businessName: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(logWhatsApp, {});
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    `Hi ${customerName.split(" ")[0]}, ${businessName} here — `,
  );

  const phoneDigits = phone.replace(/\D/g, "");
  const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        WhatsApp
      </Button>
    );
  }
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="body" value={message} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      <Textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Your WhatsApp message…"
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <a href={waUrl} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm">
            Open in WhatsApp
          </Button>
        </a>
        <Submit>Log as sent</Submit>
      </div>
      <p className="text-xs text-fg-muted">
        &ldquo;Open in WhatsApp&rdquo; opens the chat with your message pre-filled. Send it there,
        then click <em>Log as sent</em> to record it here.
      </p>
    </form>
  );
}

export function EmailForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(sendEmail, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Email
      </Button>
    );
  }
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3"
      key={state.ok ? "saved" : "draft"}
    >
      <input type="hidden" name="customerId" value={customerId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Email sent.</p>
      )}
      <Input name="subject" placeholder="Subject" required />
      <Textarea name="body" rows={6} placeholder="Your message…" required />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Submit>Send email</Submit>
      </div>
    </form>
  );
}
