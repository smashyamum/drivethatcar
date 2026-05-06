import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Enter your code · Drive That Car" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Enter your code</CardTitle>
          <CardDescription>
            We&rsquo;ve sent a 6-digit code to{" "}
            <span className="font-medium text-fg">{email ?? "your email"}</span>.
            Enter it below to finish creating your account.
          </CardDescription>
        </CardHeader>
        <VerifyForm email={email ?? ""} />
        <div className="mt-4 text-xs text-fg-muted">
          Don&rsquo;t see it? Check spam, or{" "}
          <Link href="/signup" className="font-medium hover:underline">
            try a different email
          </Link>
          .
        </div>
      </Card>
    </div>
  );
}
