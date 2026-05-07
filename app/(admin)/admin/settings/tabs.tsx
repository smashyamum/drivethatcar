"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/team", label: "Team" },
  { href: "/admin/settings/billing", label: "Billing" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border">
      <nav className="flex gap-6">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                active
                  ? "border-fg text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
