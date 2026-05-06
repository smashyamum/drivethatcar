import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Check your email · Drive That Car" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We&rsquo;ve sent a verification link to{" "}
            <span className="font-medium text-fg">{email ?? "your email"}</span>.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-4 text-sm text-fg-muted">
          <p>
            Click the link in the email to confirm your address and finish
            setting up your account. You can close this tab — the link will
            sign you in automatically.
          </p>
          <p className="text-xs">
            Don&rsquo;t see it? Check spam, or{" "}
            <Link href="/signup" className="font-medium hover:underline">
              try a different email
            </Link>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
