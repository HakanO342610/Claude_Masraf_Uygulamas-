-- AlterTable
ALTER TABLE "users" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "external_source" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_synced_at" TIMESTAMP(3),
ADD COLUMN     "organization_id" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'BASIC',
    "erpType" TEXT NOT NULL DEFAULT 'NONE',
    "erp_config" TEXT,
    "idp_type" TEXT NOT NULL DEFAULT 'NONE',
    "idp_config" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_stats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_external_id_external_source_idx" ON "users"("external_id", "external_source");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
