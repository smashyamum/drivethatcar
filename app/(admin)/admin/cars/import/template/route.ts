import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { csvEscape } from "@/lib/csv";

export const dynamic = "force-dynamic";

const HEADERS = [
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
];

const SAMPLE_ROWS: Array<Array<string | number>> = [
  [
    "BMW",
    "320d",
    2022,
    "M Sport",
    45000,
    95000,
    "Alpine White",
    "automatic",
    "diesel",
    "saloon",
    "DXB-A-12345",
    "Full service history. One owner.",
    "available",
  ],
  [
    "Toyota",
    "Land Cruiser",
    2021,
    "VXR",
    62000,
    285000,
    "Pearl White",
    "automatic",
    "petrol",
    "suv",
    "",
    "",
    "available",
  ],
];

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lines = [HEADERS.map(csvEscape).join(",")];
  for (const row of SAMPLE_ROWS) {
    lines.push(row.map(csvEscape).join(","));
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cars-template.csv"',
    },
  });
}
