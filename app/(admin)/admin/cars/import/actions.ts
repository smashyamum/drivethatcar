"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/tenant";
import { generateUniqueSlug } from "@/lib/slug";
import { parseCsv } from "@/lib/csv";

const optional = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

// Lowercase, trim, collapse internal whitespace, replace dashes with underscores.
function normalise(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const TRANSMISSION_ALIASES: Record<string, "manual" | "automatic" | "semi_auto"> = {
  manual: "manual",
  stick: "manual",
  automatic: "automatic",
  auto: "automatic",
  cvt: "automatic",
  dsg: "automatic",
  tiptronic: "automatic",
  semi_auto: "semi_auto",
  semi_automatic: "semi_auto",
  semiauto: "semi_auto",
  dct: "semi_auto",
};

const FUEL_ALIASES: Record<string, "petrol" | "diesel" | "hybrid" | "phev" | "electric"> = {
  petrol: "petrol",
  gas: "petrol",
  gasoline: "petrol",
  diesel: "diesel",
  hybrid: "hybrid",
  phev: "phev",
  plug_in_hybrid: "phev",
  plugin_hybrid: "phev",
  electric: "electric",
  ev: "electric",
};

const BODY_ALIASES: Record<
  string,
  "hatchback" | "saloon" | "estate" | "suv" | "coupe" | "convertible" | "mpv" | "pickup"
> = {
  hatchback: "hatchback",
  hatch: "hatchback",
  saloon: "saloon",
  sedan: "saloon",
  estate: "estate",
  wagon: "estate",
  station_wagon: "estate",
  suv: "suv",
  crossover: "suv",
  coupe: "coupe",
  convertible: "convertible",
  cabriolet: "convertible",
  cabrio: "convertible",
  roadster: "convertible",
  mpv: "mpv",
  minivan: "mpv",
  van: "mpv",
  pickup: "pickup",
  truck: "pickup",
  ute: "pickup",
};

const STATUS_ALIASES: Record<string, "available" | "sold" | "hidden"> = {
  available: "available",
  active: "available",
  in_stock: "available",
  instock: "available",
  for_sale: "available",
  sold: "sold",
  hidden: "hidden",
  draft: "hidden",
  archived: "hidden",
};

function aliasEnum<T extends string>(table: Record<string, T>, valid: readonly T[]) {
  return z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    const k = normalise(v);
    if (k === "") return undefined;
    return table[k] ?? v; // unknown values pass through and the enum rejects
  }, z.enum(valid as unknown as [T, ...T[]]).nullable().optional());
}

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
  price: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const s = String(v).trim().replace(/[, ]/g, "");
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().nonnegative()),
  colour: z.string().trim().nullable().optional(),
  transmission: aliasEnum(TRANSMISSION_ALIASES, ["manual", "automatic", "semi_auto"]),
  fuel_type: aliasEnum(FUEL_ALIASES, ["petrol", "diesel", "hybrid", "phev", "electric"]),
  body_type: aliasEnum(BODY_ALIASES, [
    "hatchback",
    "saloon",
    "estate",
    "suv",
    "coupe",
    "convertible",
    "mpv",
    "pickup",
  ]),
  registration: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  status: z.preprocess((v) => {
    if (v === null || v === undefined) return "available";
    const k = normalise(v);
    if (k === "") return "available";
    return STATUS_ALIASES[k] ?? v;
  }, z.enum(["available", "sold", "hidden"]).default("available")),
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

const HEADER_ALIASES: Record<string, (typeof KNOWN_HEADERS)[number]> = {
  manufacturer: "make",
  brand: "make",
  trim: "variant",
  spec: "variant",
  km: "mileage",
  kms: "mileage",
  kilometres: "mileage",
  kilometers: "mileage",
  odometer: "mileage",
  price_aed: "price",
  price_dh: "price",
  price_dhs: "price",
  price_dirham: "price",
  price_dirhams: "price",
  cost: "price",
  color: "colour",
  gearbox: "transmission",
  fuel: "fuel_type",
  body: "body_type",
  reg: "registration",
  plate: "registration",
  number_plate: "registration",
  notes: "description",
  details: "description",
  state: "status",
};

function normaliseHeader(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if ((KNOWN_HEADERS as readonly string[]).includes(cleaned)) return cleaned;
  if (HEADER_ALIASES[cleaned]) return HEADER_ALIASES[cleaned];
  return cleaned;
}

export async function importCars(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { id: orgId, limits } = await getActiveOrg();
  if (!limits.csvImport) {
    return {
      error: "CSV import is a Starter plan feature. Upgrade to import cars in bulk.",
    };
  }

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

  const headers = rows[0].map((h) => normaliseHeader(h));
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
            .eq("organization_id", orgId)
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
      organization_id: orgId,
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
