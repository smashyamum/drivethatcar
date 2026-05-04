export const CAR_PHOTOS_BUCKET = "car-photos";

export function carPhotoPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${CAR_PHOTOS_BUCKET}/${storagePath}`;
}
