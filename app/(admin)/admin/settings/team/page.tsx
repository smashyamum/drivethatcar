import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembership, getActiveOrg } from "@/lib/tenant";
import { removeMember } from "./actions";
import { ConfirmRemoveButton } from "./confirm-remove-button";
import { TeamForms } from "./team-forms";

export const metadata = { title: "Team · Admin" };

type MemberRow = {
  membership_id: string;
  user_id: string;
  email: string;
  role: "owner" | "admin" | "sales";
  joined_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "sales";
  expires_at: string;
};

async function loadTeam(orgId: string): Promise<{
  members: MemberRow[];
  invites: InviteRow[];
}> {
  const service = createSupabaseServiceClient();
  const { data: rawMemberships } = await service
    .from("memberships")
    .select("id, user_id, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  const members: MemberRow[] = await Promise.all(
    (rawMemberships ?? []).map(async (m) => {
      const { data } = await service.auth.admin.getUserById(m.user_id as string);
      return {
        membership_id: m.id as string,
        user_id: m.user_id as string,
        email: data?.user?.email ?? "(unknown)",
        role: m.role as MemberRow["role"],
        joined_at: m.created_at as string,
      };
    }),
  );

  const { data: rawInvites } = await service
    .from("org_invitations")
    .select("id, email, role, expires_at, accepted_at")
    .eq("organization_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });

  const invites: InviteRow[] = (rawInvites ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as "admin" | "sales",
    expires_at: i.expires_at as string,
  }));

  return { members, invites };
}

export default async function TeamPage() {
  const { role: actorRole } = await getActiveMembership();
  const org = await getActiveOrg();

  if (!org.limits.team) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Team</CardDescription>
          <CardTitle>Invite teammates with Pro</CardTitle>
        </CardHeader>
        <p className="text-sm text-fg-muted">
          The Pro plan lets you invite up to 5 teammates with their own logins, with Admin or
          Sales roles. Sales reps see only their own customers and bookings.
        </p>
        <div className="mt-4">
          <Link
            href="/admin/settings/billing"
            className="inline-flex items-center justify-center rounded-md bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Upgrade to Pro
          </Link>
        </div>
      </Card>
    );
  }

  const { members, invites } = await loadTeam(org.id);
  const seatsUsed = members.length + invites.length;
  const seatsTotal = org.limits.teamSeats;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Invite teammates and manage their access. Using {seatsUsed} of {seatsTotal} seats on
          your plan.
        </p>
      </div>

      {/* Members */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Members</h2>
        <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.membership_id}>
                  <td className="px-4 py-3 font-medium">{m.email}</td>
                  <td className="px-4 py-3 capitalize text-fg-muted">{m.role}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {actorRole === "owner" && m.role !== "owner" && (
                      <form action={removeMember}>
                        <input type="hidden" name="membership_id" value={m.membership_id} />
                        <ConfirmRemoveButton />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invite + pending invites */}
      <TeamForms
        canInvite={actorRole === "owner" || actorRole === "admin"}
        invites={invites}
        seatsAvailable={seatsTotal - seatsUsed}
      />
    </div>
  );
}
