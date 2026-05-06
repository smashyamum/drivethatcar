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

// Random lowercase alphanumeric slug. Confusable characters (0/o, 1/i/l) are
// excluded so URLs are easy to read aloud or copy. 8 chars = ~3.4 trillion
// combos; collisions effectively never happen but we still loop on retry.
const RANDOM_SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const RANDOM_SLUG_LENGTH = 8;

function randomOrgSlug(): string {
  const arr = new Uint8Array(RANDOM_SLUG_LENGTH);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < RANDOM_SLUG_LENGTH; i++) {
    out += RANDOM_SLUG_ALPHABET[arr[i] % RANDOM_SLUG_ALPHABET.length];
  }
  return out;
}

// Auto-generated public URL for new orgs. Pro plan can override this with a
// custom slug from Settings; Free/Starter keep the random one.
export async function generateRandomOrgSlug(
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = randomOrgSlug();
    if (RESERVED_ORG_SLUGS.has(candidate)) continue;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not generate unique random org slug after 100 tries");
}
