-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "product_source_type" AS ENUM ('manual', 'import_csv', 'import_xlsx', 'seed');

-- CreateEnum
CREATE TYPE "media_asset_type" AS ENUM ('ORIGINAL_IMAGE', 'AI_IMAGE', 'VIDEO', 'AUDIO', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "media_source_type" AS ENUM ('upload', 'import_url', 'generated', 'seed');

-- CreateEnum
CREATE TYPE "media_upload_status" AS ENUM ('pending', 'completed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "publish_mode" AS ENUM ('immediate', 'scheduled', 'draft');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_settings" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'vi-VN',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "default_video_mode" VARCHAR(40) NOT NULL DEFAULT 'image_slideshow',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "brand" VARCHAR(100),
    "description" TEXT,
    "cost_price" DECIMAL(14,2),
    "selling_price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source_url" VARCHAR(2048),
    "source_type" "product_source_type" NOT NULL DEFAULT 'manual',
    "pending_image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "product_status" NOT NULL DEFAULT 'draft',
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" CHAR(64) NOT NULL,
    "asset_type" "media_asset_type" NOT NULL,
    "source_type" "media_source_type" NOT NULL DEFAULT 'upload',
    "source_url" VARCHAR(2048),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "product_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("product_id","media_asset_id")
);

-- CreateTable
CREATE TABLE "media_uploads" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(100) NOT NULL,
    "declared_size" INTEGER NOT NULL,
    "status" "media_upload_status" NOT NULL DEFAULT 'pending',
    "failure_reason" VARCHAR(500),
    "media_asset_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_drafts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "batch_key" VARCHAR(80) NOT NULL,
    "product_id" UUID,
    "product_name" VARCHAR(200) NOT NULL,
    "prompt" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "media_asset_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "video_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_drafts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "video_draft_id" UUID,
    "video_name" VARCHAR(200) NOT NULL,
    "account_ref" VARCHAR(100),
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mode" "publish_mode" NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "attach_cart" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "publishing_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_drafts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "product_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "content" JSONB NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "script_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_presets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prompt_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "application_settings_workspace_id_key" ON "application_settings"("workspace_id");

-- CreateIndex
CREATE INDEX "products_workspace_id_status_idx" ON "products"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "products_workspace_id_category_idx" ON "products"("workspace_id", "category");

-- CreateIndex
CREATE INDEX "products_workspace_id_created_at_idx" ON "products"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "products_search_text_trgm_idx" ON "products" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "products_workspace_id_sku_key" ON "products"("workspace_id", "sku");

-- CreateIndex
CREATE INDEX "media_assets_workspace_id_asset_type_created_at_idx" ON "media_assets"("workspace_id", "asset_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_bucket_storage_key_key" ON "media_assets"("bucket", "storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_workspace_id_sha256_key" ON "media_assets"("workspace_id", "sha256");

-- CreateIndex
CREATE INDEX "product_media_media_asset_id_idx" ON "product_media"("media_asset_id");

-- CreateIndex
CREATE INDEX "product_media_product_id_sort_order_idx" ON "product_media"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_uploads_storage_key_key" ON "media_uploads"("storage_key");

-- CreateIndex
CREATE INDEX "media_uploads_status_expires_at_idx" ON "media_uploads"("status", "expires_at");

-- CreateIndex
CREATE INDEX "media_uploads_workspace_id_created_at_idx" ON "media_uploads"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "video_drafts_workspace_id_created_at_idx" ON "video_drafts"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "video_drafts_workspace_id_batch_key_idx" ON "video_drafts"("workspace_id", "batch_key");

-- CreateIndex
CREATE INDEX "publishing_drafts_workspace_id_scheduled_at_idx" ON "publishing_drafts"("workspace_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "script_drafts_workspace_id_updated_at_idx" ON "script_drafts"("workspace_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_presets_workspace_id_scope_name_key" ON "prompt_presets"("workspace_id", "scope", "name");

-- AddForeignKey
ALTER TABLE "application_settings" ADD CONSTRAINT "application_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_drafts" ADD CONSTRAINT "video_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_drafts" ADD CONSTRAINT "video_drafts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_drafts" ADD CONSTRAINT "publishing_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_drafts" ADD CONSTRAINT "publishing_drafts_video_draft_id_fkey" FOREIGN KEY ("video_draft_id") REFERENCES "video_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_drafts" ADD CONSTRAINT "script_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_drafts" ADD CONSTRAINT "script_drafts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_presets" ADD CONSTRAINT "prompt_presets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
