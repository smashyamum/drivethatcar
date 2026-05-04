"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string; alt: string };

export function CarGallery({ photos }: { photos: Photo[] }) {
  const [activeId, setActiveId] = useState(photos[0]?.id ?? "");
  const active = photos.find((p) => p.id === activeId) ?? photos[0];

  if (!active) {
    return (
      <div className="aspect-[4/3] w-full rounded-[12px] bg-bg-muted" aria-hidden />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-bg-muted">
        <Image
          src={active.url}
          alt={active.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 720px"
          priority
          className="object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActiveId(photo.id)}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                photo.id === active.id
                  ? "border-fg"
                  : "border-transparent hover:border-border-strong",
              )}
              aria-label={`Show photo ${photo.alt || ""}`}
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
