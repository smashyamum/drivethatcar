"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateUniqueSlug } from "@/lib/slug";
import { parseCsv } from "@/lib/csv";

const optional = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const RowSchema = z.object({
  make: z.string().trim().min(1, "make is required"),
  model: z.string().trim().min(1, "model is required"),
  year: z.coerce.number().int().min(1900).max(2100),
  variant: z.string().trim().nullable().optional(),
  mileage: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s === "") return null;
      const n = Number(s.replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : null;
    })
    .pipe(z.number().int().nonnegative().nullable()),
  price: z.coerce.number().nonnegative(),
  colour: z.string().trim().nullable().optional(),
  transmission: z
    .enum(["manual", "automatic", "semi_auto"])
    .nullable()
    .optional(),
  fuel_type: z
    .enum(["petrol", "diesel", "hybrid", "phev", "electric"])
    .nullable()
    .optional(),
  body_type: z
    .enum([
      "hatchback",
      "saloon",
      "estate",
      "suv",
      "coupe",
      "convertible",
      "mpv",
      "pickup",
    ])
    .nullable()
    .optional(),
  registration: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(["available", "sold", "hidden"]).default("available"),
});

export type ImportState = {
  error?: string;
  imported?: number;
  failures?: Array<{ row: number; error: string }>;
};

const REQUIRED_HEADERS = ["make", "model", "year", "price"] as const;
const KNOWN_HEADERS = [
  "make",
  "model",
  "year",
  "variant",
  "mileage",
  "price",
  "colour",
  "transmission",
  "fuel_type",
  "body_type",
  "registration",
  "description",
  "status",
] as const;

export async function importCars(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pick a CSV file to upload." };
  }
  if (file.size > 2_000_000) {
    return { error: "File is too big (>2MB)." };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { error: "CSV needs a header row plus at least one car." };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { error: `Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}` };
  }

  let imported = 0;
  const failures: Array<{ row: number; error: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => c.trim() === "")) continue;

    const record: Record<string, string | undefined> = {};
    headers.forEach((h, j) => {
      if ((KNOWN_HEADERS as readonly string[]).includes(h)) {
        record[h] = cells[j]?.trim() ?? "";
      }
    });
    // Zod's optional/nullable enums need empty strings turned into undefined
    for (const k of Object.keys(record)) {
      if (record[k] === "") record[k] = undefined;
    }

    const parsed = RowSchema.safeParse(record);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.join(".");
      failures.push({
        row: r + 1,
        error: path ? `${path}: ${issue.message}` : issue.message,
      });
      continue;
    }

    const data = parsed.data;
    let slug: string;
    try {
      slug = await generateUniqueSlug(
        {
          year: data.year,
          make: data.make,
          model: data.model,
          variant: data.variant ?? null,
          colour: data.colour ?? null,
        },
        async (candidate) => {
          const { data: existing } = await supabase
            .from("cars")
            .select("id")
            .eq("slug", candidate)
            .maybeSingle();
          return !!existing;
        },
      );
    } catch (e) {
      failures.push({
        row: r + 1,
        error: e instanceof Error ? e.message : "Slug generation failed",
      });
      continue;
    }

    const { price, ...rest } = data;
    const { error } = await supabase.from("cars").insert({
      ...rest,
      variant: optional(rest.variant),
      colour: optional(rest.colour),
      registration: optional(rest.registration),
      description: optional(rest.description),
      slug,
      price_pence: Math.round(price * 100),
    });

    if (error) {
      failures.push({ row: r + 1, error: error.message });
      continue;
    }
    imported++;
  }

  if (imported > 0) {
    revalidatePath("/admin/cars");
    revalidatePath("/cars");
  }

  return { imported, failures };
}
