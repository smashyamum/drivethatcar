import crypto from "crypto";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { acceptInvite } from "./actions";

export const metadata = { title: "Accept invite · Drive That Car" };

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "This invite link doesn't exist. Ask the person who sent it for a new one.",
  used: "This invite has already been accepted.",
  expired: "This invite has expired. Ask the person who sent it for a new one.",
  already_in_org:
    "You're already a member of another organization. Multi-org accounts aren't supported yet.",
  could_not_join: "We couldn't add you to the team. Try again or contact support.",
};

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const service = createSupabaseServiceClient();
  const { data: invite } = await service
    .from("org_invitations")
    .select("id, organization_id, email, role, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  // Look up the org name for friendlier copy.
  let orgName: string | null = null;
  if (invite) {
    const { data: org } = await service
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id as string)
      .maybeSingle();
    orgName = (org?.name as string | undefined) ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const expired =
    invite && new Date(invite.expires_at as string).getTime() < Date.now();
  const alreadyAccepted = invite?.accepted_at != null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re invited</h1>
        {invite && orgName && (
          <p className="mt-1 text-sm text-fg-muted">
            Join <span className="font-medium text-fg">{orgName}</span> as{" "}
            <span className="font-medium text-fg capitalize">{invite.role as string}</span>.
          </p>
        )}
      </div>

      {error && ERROR_MESSAGES[error] && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ERROR_MESSAGES[error]}
        </div>
      )}

      {!invite ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This invite link is invalid. Ask the person who sent it for a new one.
        </div>
      ) : expired ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          This invite has expired (invites are valid for 7 days). Ask for a new one.
        </div>
      ) : alreadyAccepted ? (
        <div className="rounded-md border border-border bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          This invite has already been accepted.{" "}
          <Link href="/admin" className="font-medium text-fg hover:underline">
            Go to dashboard
          </Link>
          .
        </div>
      ) : !user ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-bg p-6">
          <p className="text-sm text-fg-muted">
            Sign in or create an account with{" "}
            <span className="font-medium text-fg">{invite.email as string}</span> to accept this
            invite.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/signup?next=${encodeURIComponent(`/accept-invite/${token}`)}&email=${encodeURIComponent(invite.email as string)}`}
              className="inline-flex items-center justify-center rounded-md bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
            >
              Create account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/accept-invite/${token}`)}`}
              className="inline-flex items-center justify-center rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium hover:bg-bg-subtle"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      ) : (
        <form action={acceptInvite} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-fg-muted">
            Signed in as <span className="font-medium text-fg">{user.email}</span>. Click below to
            join the team.
          </p>
          <Button type="submit">Accept invite</Button>
        </form>
      )}
    </div>
  );
}
