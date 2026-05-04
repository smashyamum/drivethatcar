"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { CAR_PHOTOS_BUCKET } from "@/lib/supabase/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB / file

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

function extensionFor(type: string): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

export type UploadResult = { uploaded: number; error?: string };

export async function uploadCarPhotos(carId: string, formData: FormData): Promise<UploadResult> {
  await requireAuth();
  const service = createSupabaseServiceClient();

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { uploaded: 0, error: "No files selected." };

  const { data: existing } = await service
    .from("car_photos")
    .select("position, is_primary")
    .eq("car_id", carId);

  let nextPosition = (existing ?? []).reduce((max, p) => Math.max(max, p.position), -1) + 1;
  let hasPrimary = (existing ?? []).some((p) => p.is_primary);

  let uploaded = 0;
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return { uploaded, error: `Unsupported file type: ${file.type || "unknown"}` };
    }
    if (file.size > MAX_BYTES) {
      return {
        uploaded,
        error: `File too large (max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB): ${file.name}`,
      };
    }

    const path = `${carId}/${randomUUID()}.${extensionFor(file.type)}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await service.storage
      .from(CAR_PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return { uploaded, error: uploadError.message };
    }

    const { error: insertError } = await service.from("car_photos").insert({
      car_id: carId,
      storage_path: path,
      position: nextPosition,
      is_primary: !hasPrimary,
    });

    if (insertError) {
      // Roll back the storage object so we don't orphan it
      await service.storage.from(CAR_PHOTOS_BUCKET).remove([path]);
      return { uploaded, error: insertError.message };
    }

    if (!hasPrimary) hasPrimary = true;
    nextPosition += 1;
    uploaded += 1;
  }

  revalidatePath(`/admin/cars/${carId}`);
  revalidatePath(`/cars`);
  // The car detail page is dynamic by slug — invalidate broadly:
  revalidatePath(`/`, "layout");
  return { uploaded };
}

export async function deleteCarPhoto(photoId: string): Promise<void> {
  await requireAuth();
  const service = createSupabaseServiceClient();

  const { data: photo, error: loadError } = await service
    .from("car_photos")
    .select("id, car_id, storage_path, is_primary")
    .eq("id", photoId)
    .maybeSingle();

  if (loadError || !photo) throw new Error(loadError?.message ?? "Photo not found");

  await service.storage.from(CAR_PHOTOS_BUCKET).remove([photo.storage_path]);
  const { error: deleteError } = await service.from("car_photos").delete().eq("id", photoId);
  if (deleteError) throw new Error(deleteError.message);

  // If we deleted the primary, promote the lowest-position remaining photo.
  if (photo.is_primary) {
    const { data: remaining } = await service
      .from("car_photos")
      .select("id")
      .eq("car_id", photo.car_id)
      .order("position", { ascending: true })
      .limit(1);

    if (remaining && remaining[0]) {
      await service.from("car_photos").update({ is_primary: true }).eq("id", remaining[0].id);
    }
  }

  revalidatePath(`/admin/cars/${photo.car_id}`);
  revalidatePath(`/cars`);
  revalidatePath(`/`, "layout");
}

export async function setPrimaryCarPhoto(photoId: string): Promise<void> {
  await requireAuth();
  const service = createSupabaseServiceClient();

  const { data: photo, error: loadError } = await service
    .from("car_photos")
    .select("id, car_id")
    .eq("id", photoId)
    .maybeSingle();

  if (loadError || !photo) throw new Error(loadError?.message ?? "Photo not found");

  // Unset existing primary first to avoid violating the partial unique index.
  await service
    .from("car_photos")
    .update({ is_primary: false })
    .eq("car_id", photo.car_id)
    .neq("id", photoId);

  const { error: updateError } = await service
    .from("car_photos")
    .update({ is_primary: true })
    .eq("id", photoId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/admin/cars/${photo.car_id}`);
  revalidatePath(`/cars`);
  revalidatePath(`/`, "layout");
}
