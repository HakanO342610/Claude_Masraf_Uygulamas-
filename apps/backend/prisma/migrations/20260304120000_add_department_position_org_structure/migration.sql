-- CreateTable: departments
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "external_id" TEXT,
    "parent_id" TEXT,
    "manager_id" TEXT,
    "organization_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: positions
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "external_id" TEXT,
    "department_id" TEXT,
    "parent_position_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "organization_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: users — yeni alanlar
ALTER TABLE "users" ADD COLUMN "department_id" TEXT;
ALTER TABLE "users" ADD COLUMN "position_id" TEXT;
ALTER TABLE "users" ADD COLUMN "job_title" TEXT;
ALTER TABLE "users" ADD COLUMN "upper_manager_id" TEXT;

-- AlterTable: organizations — setupModel alanı
ALTER TABLE "organizations" ADD COLUMN "setup_model" TEXT NOT NULL DEFAULT 'STANDALONE';

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");
CREATE UNIQUE INDEX "departments_code_organization_id_key" ON "departments"("code", "organization_id");

CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");
CREATE INDEX "positions_parent_position_id_idx" ON "positions"("parent_position_id");
CREATE UNIQUE INDEX "positions_code_organization_id_key" ON "positions"("code", "organization_id");

CREATE INDEX "users_department_id_idx" ON "users"("department_id");
CREATE INDEX "users_position_id_idx" ON "users"("position_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_position_id_fkey" FOREIGN KEY ("parent_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_upper_manager_id_fkey" FOREIGN KEY ("upper_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
