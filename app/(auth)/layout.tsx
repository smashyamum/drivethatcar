import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-subtle">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link href="/" className="text-sm font-semibold">
            Drive That Car
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col px-6 py-10">
        {children}
      </main>
    </div>
  );
}
