-- Add manager_position_id to departments table
ALTER TABLE "departments" ADD COLUMN "manager_position_id" TEXT;

-- Foreign key constraint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_position_id_fkey"
  FOREIGN KEY ("manager_position_id") REFERENCES "positions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for performance
CREATE INDEX "departments_manager_position_id_idx" ON "departments"("manager_position_id");
