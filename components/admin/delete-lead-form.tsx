"use client";

import { Button } from "@/components/ui/button";

export function DeleteLeadForm({
  action,
  customerName,
  bookingCount,
}: {
  action: () => Promise<void> | void;
  customerName: string;
  bookingCount: number;
}) {
  const confirmMessage =
    bookingCount > 0
      ? `Permanently delete ${customerName}? This will also delete ${bookingCount} booking${bookingCount === 1 ? "" : "s"}. This can't be undone.`
      : `Permanently delete ${customerName}? This can't be undone.`;
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="danger"
        size="sm"
        onClick={(e) => {
          if (!window.confirm(confirmMessage)) e.preventDefault();
        }}
      >
        Delete lead
      </Button>
    </form>
  );
}
