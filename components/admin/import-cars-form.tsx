"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importCars, type ImportState } from "@/app/(admin)/admin/cars/import/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importing…" : "Import"}
    </Button>
  );
}

export function ImportCarsForm() {
  const [state, formAction] = useActionState<ImportState, FormData>(importCars, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {(state.imported ?? 0) > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Imported {state.imported} car{state.imported === 1 ? "" : "s"}.
        </p>
      )}

      {state.failures && state.failures.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Skipped {state.failures.length} row{state.failures.length === 1 ? "" : "s"}:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {state.failures.slice(0, 50).map((f, i) => (
              <li key={i}>
                Row {f.row}: {f.error}
              </li>
            ))}
            {state.failures.length > 50 && (
              <li>… and {state.failures.length - 50} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="cursor-pointer"
        />
        <SubmitButton />
      </div>
    </form>
  );
}
