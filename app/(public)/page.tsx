import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <span className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs font-medium text-fg-muted">
          Book in 60 seconds
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
          Book a viewing or test&nbsp;drive
        </h1>
        <p className="mt-5 max-w-xl text-lg text-fg-muted">
          Pick the car. Pick a time. Leave your details. We&rsquo;ll send a confirmation email.
        </p>
        <div className="mt-10 flex items-center gap-3">
          <Link href="/cars">
            <Button size="lg">Browse cars</Button>
          </Link>
        </div>
      </main>
      <footer className="border-t border-border bg-bg-subtle">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-fg-subtle">
          © {new Date().getFullYear()} Car Booking
        </div>
      </footer>
    </div>
  );
}
