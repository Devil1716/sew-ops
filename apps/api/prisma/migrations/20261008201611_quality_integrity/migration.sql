/*
  Warnings:

  - A unique constraint covering the columns `[factory_id,idempotency_key]` on the table `quality_checks` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotency_key` to the `quality_checks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "quality_checks" ADD COLUMN     "idempotency_key" TEXT NOT NULL,
ADD COLUMN     "voided_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "quality_checks_factory_id_idempotency_key_key" ON "quality_checks"("factory_id", "idempotency_key");

-- A check must carry data; rejected cannot exceed inspected (inspected 0 = extra defect breakdown row).
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_qty_check" CHECK ("inspected_qty" >= 0 AND "rejected_qty" >= 0 AND ("inspected_qty" = 0 OR "rejected_qty" <= "inspected_qty") AND ("inspected_qty" > 0 OR "rejected_qty" > 0));

-- The work order counter can never go negative, even with buggy code.
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completed_nonneg" CHECK ("quantity_completed" >= 0);