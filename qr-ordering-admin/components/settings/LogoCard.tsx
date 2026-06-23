"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/common/Toast";
import { uploadImage, ApiError } from "@/lib/api";
import { assetUrl } from "@/lib/assets";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

// Restaurant logo: upload / replace / remove a single brand image. Shown on the
// customer menu header + printed receipts. Saved through the shared settings
// mutation (logoUrl). The preview uses object-contain so logos aren't cropped.
export function LogoCard({
  logoUrl,
  saving,
  onSave,
}: {
  logoUrl: string | null;
  saving: boolean;
  onSave: (logoUrl: string | null) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onSave(url);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Logo upload failed.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-slate-900">Restaurant logo</p>
            <p className="text-sm text-slate-500">
              Shown on the customer menu header and printed receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(logoUrl)}
                alt="Restaurant logo"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || saving}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus />
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </>
              )}
            </Button>
            {logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave(null)}
                disabled={uploading || saving}
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          PNG, JPEG, WEBP or GIF · max 5 MB · a square or wide logo works best.
        </p>
      </CardContent>
    </Card>
  );
}
