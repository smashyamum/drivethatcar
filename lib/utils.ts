import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `price_pence` is the column name but it stores the price in minor currency units —
// 1/100 AED (fils) for this deployment.
export function formatPrice(minorUnits: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

export function formatMileage(km: number | null): string {
  if (km == null) return "—";
  return new Intl.NumberFormat("en-AE").format(km) + " km";
}
