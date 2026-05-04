import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-fg-muted">That page doesn&rsquo;t exist.</p>
      <Link href="/" className="mt-6 text-sm underline">
        Go home
      </Link>
    </div>
  );
}
