-- Replace the single banner image with an image list (mirrors item images).
-- Add the new list column, preserve any existing single image as the first
-- slideshow image, then drop the old single-image column.
ALTER TABLE "Store" ADD COLUMN "bannerImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Store"
SET "bannerImageUrls" = ARRAY["bannerImageUrl"]
WHERE "bannerImageUrl" IS NOT NULL AND "bannerImageUrl" <> '';

ALTER TABLE "Store" DROP COLUMN "bannerImageUrl";
