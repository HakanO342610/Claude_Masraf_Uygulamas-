/*
  Warnings:

  - A unique constraint covering the columns `[receipt_number]` on the table `expenses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "receipt_number" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "confirmation_token" TEXT,
ADD COLUMN     "fcm_token" TEXT,
ADD COLUMN     "is_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_email_confirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "monthly_limit" DECIMAL(12,2) NOT NULL,
    "require_receipt_above" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_receipt_number_key" ON "expenses"("receipt_number");
