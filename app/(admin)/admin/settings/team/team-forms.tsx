"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createInvite, revokeInvite, type InviteState } from "./actions";

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "sales";
  expires_at: string;
};

function InviteSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Generating…" : "Generate invite link"}
    </Button>
  );
}

function RevokeSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}

export function TeamForms({
  canInvite,
  invites,
  seatsAvailable,
}: {
  canInvite: boolean;
  invites: InviteRow[];
  seatsAvailable: number;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);
  const noSeats = seatsAvailable <= 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Invite form */}
      {canInvite && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Invite a teammate
          </h2>
          <div className="rounded-[12px] border border-border bg-bg p-6">
            {state.error && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            {state.ok && state.link && (
              <div className="mb-4 flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-sm text-emerald-900">
                  Invite created for <span className="font-medium">{state.email}</span>. Send them
                  this link (it works for 7 days):
                </p>
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-bg px-3 py-2 text-xs">
                  <code className="flex-1 truncate font-mono text-fg">{state.link}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(state.link!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="rounded-md bg-fg px-2 py-1 text-[11px] font-semibold text-bg hover:opacity-90"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}
            <form action={formAction} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="teammate@example.com"
                    required
                    disabled={noSeats}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select id="role" name="role" defaultValue="sales" disabled={noSeats}>
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-fg-muted">
                <span className="font-medium text-fg">Sales</span> sees only the customers and
                bookings assigned to them.{" "}
                <span className="font-medium text-fg">Admin</span> sees everything you see, except
                billing and team management.
              </p>
              <div className="flex justify-end">
                <InviteSubmit disabled={noSeats} />
              </div>
              {noSeats && (
                <p className="text-xs text-red-700">
                  No seats available — remove a member or revoke a pending invite first.
                </p>
              )}
            </form>
          </div>
        </section>
      )}

      {/* Pending invites */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Pending invites
        </h2>
        {invites.length === 0 ? (
          <p className="text-sm text-fg-muted">No pending invites.</p>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium">{i.email}</td>
                    <td className="px-4 py-3 capitalize text-fg-muted">{i.role}</td>
                    <td className="px-4 py-3 text-fg-muted">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canInvite && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={i.id} />
                          <RevokeSubmit />
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
