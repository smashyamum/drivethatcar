"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { carPhotoPublicUrl } from "@/lib/supabase/storage";
import type { CarPhoto } from "@/lib/supabase/types";
import {
  deleteCarPhoto,
  setPrimaryCarPhoto,
  uploadCarPhotos,
  type UploadResult,
} from "@/app/(admin)/admin/cars/photo-actions";

type Props = {
  carId: string;
  photos: CarPhoto[];
};

export function PhotoManager({ carId, photos }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickFiles() {
    setError(null);
    fileInputRef.current?.click();
  }

  function onFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);

    startUpload(async () => {
      const result: UploadResult = await uploadCarPhotos(carId, formData);
      if (result.error) {
        setError(`${result.error}${result.uploaded ? ` (${result.uploaded} uploaded first)` : ""}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function onDelete(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    setError(null);
    startMutation(async () => {
      try {
        await deleteCarPhoto(photoId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  function onSetPrimary(photoId: string) {
    setError(null);
    startMutation(async () => {
      try {
        await setPrimaryCarPhoto(photoId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set primary");
      }
    });
  }

  const sortedPhotos = [...photos].sort((a, b) => a.position - b.position);
  const busy = isUploading || isMutating;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-fg">Photos</h2>
          <p className="text-sm text-fg-muted">
            JPG, PNG, WebP, or AVIF · max 8 MB each. First photo becomes the cover.
          </p>
        </div>
        <Button onClick={pickFiles} disabled={busy} type="button">
          {isUploading ? "Uploading…" : "Add photos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={onFilesSelected}
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {sortedPhotos.length === 0 ? (
        <button
          type="button"
          onClick={pickFiles}
          disabled={busy}
          className="flex aspect-[4/3] w-full max-w-md items-center justify-center rounded-[12px] border-2 border-dashed border-border-strong bg-bg-subtle text-sm text-fg-muted transition-colors hover:bg-bg-muted disabled:opacity-60"
        >
          {isUploading ? "Uploading…" : "Click to add photos"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sortedPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-[12px] border border-border bg-bg-muted"
            >
              <Image
                src={carPhotoPublicUrl(photo.storage_path)}
                alt={photo.alt ?? ""}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                className="object-cover"
              />
              {photo.is_primary && (
                <span className="absolute left-2 top-2 rounded-full bg-fg px-2 py-0.5 text-[11px] font-medium text-on-primary">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                {!photo.is_primary && (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(photo.id)}
                    disabled={busy}
                    className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-fg hover:bg-white disabled:opacity-60"
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(photo.id)}
                  disabled={busy}
                  className="ml-auto rounded-md bg-red-600/95 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
