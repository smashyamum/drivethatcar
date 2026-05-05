"use client";

import { Button } from "@/components/ui/button";

export function DeleteLeadForm({
  action,
  customerName,
}: {
  action: () => Promise<void> | void;
  customerName: string;
}) {
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="danger"
        size="sm"
        onClick={(e) => {
          if (
            !window.confirm(
              `Permanently delete ${customerName}? This can't be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Delete lead
      </Button>
    </form>
  );
}
