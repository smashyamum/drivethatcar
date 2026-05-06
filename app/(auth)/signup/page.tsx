import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · Drive That Car" };

export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Start your 7-day free trial — no credit card required.
          </CardDescription>
        </CardHeader>
        <SignupForm />
      </Card>
    </div>
  );
}
