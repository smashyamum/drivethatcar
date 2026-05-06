import slugify from "slugify";

type CarFields = {
  year: number;
  make: string;
  model: string;
  variant?: string | null;
  colour?: string | null;
};

export function buildSlugBase({ year, make, model, variant, colour }: CarFields): string {
  const parts = [year.toString(), make, model, variant, colour].filter(
    (p): p is string => p != null && p.trim().length > 0,
  );
  return slugify(parts.join(" "), { lower: true, strict: true, trim: true });
}

export async function generateUniqueSlug(
  fields: CarFields,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = buildSlugBase(fields);
  let candidate = base;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${i}`;
    i++;
    if (i > 100) throw new Error("Could not generate unique slug after 100 tries");
  }
  return candidate;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= 3 && slug.length <= 120;
}

// Reserved at the org-slug level — these clash with app routes or are sensitive.
export const RESERVED_ORG_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "signup",
  "onboarding",
  "_next",
  "cron",
  "dashboard",
  "cars",
  "car",
  "bookings",
  "booking",
  "customers",
  "settings",
  "team",
  "analytics",
  "billing",
  "d",
  "public",
  "static",
  "assets",
  "favicon",
]);

export function buildOrgSlugBase(businessName: string): string {
  return slugify(businessName, { lower: true, strict: true, trim: true });
}

export async function generateUniqueOrgSlug(
  businessName: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = buildOrgSlugBase(businessName) || "dealer";
  let candidate = base;
  let i = 2;
  while (RESERVED_ORG_SLUGS.has(candidate) || (await exists(candidate))) {
    candidate = `${base}-${i}`;
    i++;
    if (i > 100) throw new Error("Could not generate unique org slug after 100 tries");
  }
  return candidate;
}
