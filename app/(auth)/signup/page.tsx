import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · Drive That Car" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  // Heuristic: if `next` points at an invite link, this person was sent in
  // by an existing team's owner. Different copy + tighter form (no business
  // name field — they're joining a business that already exists).
  const isInvite = !!next && next.startsWith("/accept-invite/");

  return (
    <div className="mx-auto w-full max-w-sm">
      <Card>
        <CardHeader>
          {isInvite ? (
            <>
              <CardTitle>Set your password</CardTitle>
              <CardDescription>
                You&rsquo;ve been invited to join an existing team. Set a password to
                finish setting up your account.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Start your 7-day free trial — no credit card required.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <SignupForm
          lockedEmail={isInvite ? (email ?? "") : null}
          next={next ?? null}
        />
      </Card>
    </div>
  );
}
