"use client";

import { Button } from "@/components/ui/button";

export function DeleteCarForm({
  action,
  carHeadline,
}: {
  action: () => Promise<void> | void;
  carHeadline: string;
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
              `Permanently delete ${carHeadline}? This can't be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Delete car
      </Button>
    </form>
  );
}
