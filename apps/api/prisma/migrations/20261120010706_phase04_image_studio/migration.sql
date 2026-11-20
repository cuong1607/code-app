-- CreateEnum
CREATE TYPE "image_job_status" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_PROVIDER', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "image_approval_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "media_asset_type" ADD VALUE 'COMPOSED_IMAGE';

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "image_item_id" UUID,
ADD COLUMN     "image_job_id" UUID,
ADD COLUMN     "images_requested" INTEGER,
ADD COLUMN     "images_succeeded" INTEGER;

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "library_visible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "image_generation_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "product_id" UUID,
    "product_name" VARCHAR(200) NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "mode" VARCHAR(40) NOT NULL,
    "template_id" VARCHAR(60) NOT NULL,
    "template_version" VARCHAR(20) NOT NULL,
    "style_id" VARCHAR(60),
    "aspect" VARCHAR(10) NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "user_prompt" TEXT,
    "reference_asset_ids" UUID[],
    "visual_context" JSONB NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "image_job_status" NOT NULL DEFAULT 'QUEUED',
    "estimated_cost_usd" DECIMAL(12,6),
    "error_message" VARCHAR(500),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "image_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_generation_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "variation_index" INTEGER NOT NULL,
    "status" "image_job_status" NOT NULL DEFAULT 'QUEUED',
    "stage" VARCHAR(30) NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT,
    "negative_prompt" TEXT,
    "prompt_meta" JSONB NOT NULL DEFAULT '{}',
    "media_asset_id" UUID,
    "approval_status" "image_approval_status" NOT NULL DEFAULT 'pending',
    "review_note" VARCHAR(500),
    "review_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewed_at" TIMESTAMPTZ(3),
    "auto_check" JSONB,
    "regenerated_from_id" UUID,
    "estimated_cost_usd" DECIMAL(12,6),
    "latency_ms" INTEGER,
    "error_code" VARCHAR(60),
    "error_message" VARCHAR(500),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "image_generation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "image_generation_jobs_workspace_id_created_at_idx" ON "image_generation_jobs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "image_generation_jobs_workspace_id_product_id_idx" ON "image_generation_jobs"("workspace_id", "product_id");

-- CreateIndex
CREATE INDEX "image_generation_jobs_status_idx" ON "image_generation_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "image_generation_jobs_workspace_id_idempotency_key_key" ON "image_generation_jobs"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "image_generation_items_media_asset_id_key" ON "image_generation_items"("media_asset_id");

-- CreateIndex
CREATE INDEX "image_generation_items_workspace_id_approval_status_idx" ON "image_generation_items"("workspace_id", "approval_status");

-- CreateIndex
CREATE INDEX "image_generation_items_status_idx" ON "image_generation_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "image_generation_items_job_id_index_key" ON "image_generation_items"("job_id", "index");

-- CreateIndex
CREATE INDEX "ai_usage_image_job_id_idx" ON "ai_usage"("image_job_id");

-- AddForeignKey
ALTER TABLE "image_generation_jobs" ADD CONSTRAINT "image_generation_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generation_jobs" ADD CONSTRAINT "image_generation_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generation_items" ADD CONSTRAINT "image_generation_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generation_items" ADD CONSTRAINT "image_generation_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "image_generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_generation_items" ADD CONSTRAINT "image_generation_items_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
