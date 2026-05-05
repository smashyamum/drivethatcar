"use client";

import { Button } from "@/components/ui/button";

export function DeleteCarForm({
  action,
  carHeadline,
  bookingCount,
}: {
  action: () => Promise<void> | void;
  carHeadline: string;
  bookingCount: number;
}) {
  const confirmMessage =
    bookingCount > 0
      ? `Permanently delete ${carHeadline}? This will also delete ${bookingCount} booking${bookingCount === 1 ? "" : "s"} and email any future-booked customers. This can't be undone.`
      : `Permanently delete ${carHeadline}? This can't be undone.`;
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
        Delete car
      </Button>
    </form>
  );
}
