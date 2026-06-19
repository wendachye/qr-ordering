"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, ImagePlus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/common/Toast";
import { useSaveBanner } from "@/hooks/useMenuMutations";
import { uploadImage, ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";
import type { MenuSettings } from "@/lib/types";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
// Mirror item images: up to 8. Multiple images rotate as a hero slideshow.
const MAX_IMAGES = 8;
// Mirror the customer banner's defaults so the preview matches the live menu.
const DEFAULT_TITLE = "Our Menu";
const DEFAULT_SUBTITLE = "Freshly prepared and sent straight to the kitchen.";

// Configure the customer-menu hero banner: a list of images (which rotate as a
// slideshow on the customer menu) plus an overridable title and subtitle. A live
// preview mirrors the mobile banner using the first ("cover") image.
export function BannerSettingsCard({ settings }: { settings: MenuSettings }) {
  const { toast } = useToast();
  const save = useSaveBanner();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(settings.bannerImageUrls);
  const [title, setTitle] = useState(settings.bannerTitle ?? "");
  const [subtitle, setSubtitle] = useState(settings.bannerSubtitle ?? "");
  const [uploading, setUploading] = useState(false);

  // Re-seed from the saved settings (e.g. after a successful save).
  useEffect(() => {
    setImageUrls(settings.bannerImageUrls);
    setTitle(settings.bannerTitle ?? "");
    setSubtitle(settings.bannerSubtitle ?? "");
  }, [settings.bannerImageUrls, settings.bannerTitle, settings.bannerSubtitle]);

  const dirty =
    JSON.stringify(imageUrls) !== JSON.stringify(settings.bannerImageUrls) ||
    title.trim() !== (settings.bannerTitle ?? "") ||
    subtitle.trim() !== (settings.bannerSubtitle ?? "");

  const cover = imageUrls[0] ?? null;
  const atLimit = imageUrls.length >= MAX_IMAGES;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Respect the cap across this batch.
    const remaining = MAX_IMAGES - imageUrls.length;
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    if (chosen.length === 0) return;

    setUploading(true);
    try {
      for (const file of chosen) {
        const url = await uploadImage(file);
        setImageUrls((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, url]));
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Image upload failed.", "error");
    } finally {
      setUploading(false);
      // Reset so selecting the same file again re-triggers onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAt = (idx: number) =>
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));

  // Promote an image to the front — it becomes the cover and leads the slideshow.
  const makeFirst = (idx: number) =>
    setImageUrls((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.unshift(moved);
      return next;
    });

  const onSave = () =>
    save.mutate({
      bannerImageUrls: imageUrls,
      bannerTitle: title.trim() || null,
      bannerSubtitle: subtitle.trim() || null,
    });

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Menu banner</p>
            <p className="text-sm text-slate-500">
              The hero shown at the top of the customer menu. Add multiple images to
              rotate them as a slideshow.
            </p>
          </div>
        </div>

        {/* Live preview (cover image or gradient, with the overlay copy) */}
        <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(cover)}
              alt="Banner preview"
              className="h-32 w-full object-cover"
            />
          )}
          <div
            className={`${cover ? "absolute inset-0 bg-black/40" : "h-32"} flex flex-col items-center justify-center px-4 text-center text-white`}
          >
            <p className="text-xl font-extrabold tracking-tight">
              {title.trim() || DEFAULT_TITLE}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-white/85">
              {subtitle.trim() || DEFAULT_SUBTITLE}
            </p>
          </div>
          {imageUrls.length > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">
              Slideshow · {imageUrls.length} images
            </span>
          )}
        </div>

        {/* Image manager — first image is the cover / slideshow lead */}
        {imageUrls.length > 0 && (
          <div className="mb-3 grid grid-cols-4 gap-3">
            {imageUrls.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(url)}
                  alt={`Banner image ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    First
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-lg leading-none text-white transition-colors hover:bg-red-600"
                >
                  ×
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => makeFirst(idx)}
                    className="absolute inset-x-0 bottom-0 bg-slate-900/70 py-1 text-xs font-semibold text-white opacity-0 transition-opacity hover:bg-slate-900/90 group-hover:opacity-100"
                  >
                    Make first
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || atLimit}
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus />
                Add image
              </>
            )}
          </Button>
          <span className="text-sm text-slate-400">
            {atLimit
              ? `Maximum of ${MAX_IMAGES} images reached. Remove one to add another.`
              : `PNG, JPEG, WEBP or GIF · max 5 MB · ${imageUrls.length}/${MAX_IMAGES}`}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="banner-title">Title</Label>
            <Input
              id="banner-title"
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={DEFAULT_TITLE}
            />
          </div>
          <div>
            <Label htmlFor="banner-subtitle">Subtitle</Label>
            <Input
              id="banner-subtitle"
              value={subtitle}
              maxLength={160}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={DEFAULT_SUBTITLE}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {dirty && !save.isPending && (
            <span className="text-sm font-medium text-amber-600">Unsaved changes</span>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!dirty || save.isPending || uploading}
          >
            {save.isPending ? "Saving…" : "Save banner"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
