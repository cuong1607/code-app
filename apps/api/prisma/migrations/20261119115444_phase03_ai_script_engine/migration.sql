-- CreateEnum
CREATE TYPE "script_origin" AS ENUM ('ai', 'manual', 'sample', 'legacy');

-- CreateEnum
CREATE TYPE "script_validation_status" AS ENUM ('valid', 'warnings', 'invalid', 'unchecked');

-- AlterTable
ALTER TABLE "script_drafts" ADD COLUMN     "angle_id" VARCHAR(60),
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "change_note" VARCHAR(200),
ADD COLUMN     "cta" VARCHAR(300),
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hook" TEXT,
ADD COLUMN     "is_preferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issues" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "model" VARCHAR(100),
ADD COLUMN     "narration" TEXT,
ADD COLUMN     "origin" "script_origin" NOT NULL DEFAULT 'manual',
ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "provider" VARCHAR(40),
ADD COLUMN     "root_id" UUID,
ADD COLUMN     "style" VARCHAR(60),
ADD COLUMN     "target_duration_sec" INTEGER,
ADD COLUMN     "template_id" VARCHAR(60),
ADD COLUMN     "template_version" VARCHAR(20),
ADD COLUMN     "validation_status" "script_validation_status" NOT NULL DEFAULT 'unchecked',
ADD COLUMN     "variant_group_id" UUID,
ADD COLUMN     "variant_index" INTEGER,
ADD COLUMN     "version_number" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "video_drafts" ADD COLUMN     "script_id" UUID;

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "feature" VARCHAR(40) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "generation_id" UUID,
    "script_draft_id" UUID,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" DECIMAL(12,6),
    "actual_cost_usd" DECIMAL(12,6),
    "latency_ms" INTEGER,
    "error_code" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_workspace_id_created_at_idx" ON "ai_usage"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_generation_id_idx" ON "ai_usage"("generation_id");

-- CreateIndex
CREATE INDEX "script_drafts_workspace_id_root_id_version_number_idx" ON "script_drafts"("workspace_id", "root_id", "version_number");

-- CreateIndex
CREATE INDEX "script_drafts_workspace_id_variant_group_id_idx" ON "script_drafts"("workspace_id", "variant_group_id");

-- AddForeignKey
ALTER TABLE "video_drafts" ADD CONSTRAINT "video_drafts_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "script_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_drafts" ADD CONSTRAINT "script_drafts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "script_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_script_draft_id_fkey" FOREIGN KEY ("script_draft_id") REFERENCES "script_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dữ liệu Phase 02 (không xoá/ghi đè nội dung): mỗi bản nháp cũ là phiên bản 1 của chính nó.
-- Nội dung JSON v1 được nâng cấp lên v2 khi ĐỌC (upgradeScriptContent) – không sửa cột content.
UPDATE "script_drafts" SET "root_id" = "id", "origin" = 'legacy' WHERE "root_id" IS NULL;
