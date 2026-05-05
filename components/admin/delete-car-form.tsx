"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { DeleteCarState } from "@/app/(admin)/admin/cars/actions";

function DeleteButton({ confirmMessage }: { confirmMessage: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? "Deleting…" : "Delete car"}
    </Button>
  );
}

export function DeleteCarForm({
  action,
  carHeadline,
  bookingCount,
}: {
  action: (prev: DeleteCarState, formData: FormData) => Promise<DeleteCarState>;
  carHeadline: string;
  bookingCount: number;
}) {
  const [state, formAction] = useActionState<DeleteCarState, FormData>(action, {});

  const confirmMessage =
    bookingCount > 0
      ? `This car has ${bookingCount} booking${bookingCount === 1 ? "" : "s"}. Delete will likely fail — continue anyway?`
      : `Permanently delete ${carHeadline}? This can't be undone.`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      <div>
        <DeleteButton confirmMessage={confirmMessage} />
      </div>
    </form>
  );
}
