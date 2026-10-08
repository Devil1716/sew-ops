-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'operator');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('running', 'idle', 'breakdown', 'maintenance', 'offline');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('machine_issue', 'thread_empty', 'material_missing', 'quality_issue', 'break_pause', 'other');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('scheduled', 'active', 'paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProductionEventType" AS ENUM ('piece_completed', 'pieces_undo');

-- CreateTable
CREATE TABLE "factories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "factories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "employee_code" TEXT,
    "pin_hash" TEXT,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_factories" (
    "user_id" UUID NOT NULL,
    "factory_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_factories_pkey" PRIMARY KEY ("user_id","factory_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "target_per_shift" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "model" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'offline',
    "status_since" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_event_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" VARCHAR(5) NOT NULL,
    "ends_at" VARCHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "style_code" TEXT NOT NULL,
    "garment" TEXT NOT NULL,
    "quantity_target" INTEGER NOT NULL,
    "quantity_completed" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'scheduled',
    "planned_start" TIMESTAMPTZ(6) NOT NULL,
    "planned_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "machine_id" UUID,
    "shift_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "operator_id" UUID,
    "type" "ProductionEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reverses_event_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "work_order_id" UUID,
    "type" "IssueType" NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'medium',
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "note" TEXT,
    "resolution_note" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "opened_by_id" UUID,
    "acknowledged_by_id" UUID,
    "resolved_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downtime_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "issue_id" UUID,
    "reason" "IssueType" NOT NULL,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "downtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "machine_id" UUID,
    "inspector_id" UUID,
    "inspected_qty" INTEGER NOT NULL,
    "rejected_qty" INTEGER NOT NULL,
    "defect_type" TEXT,
    "note" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factory_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "factory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factories_code_key" ON "factories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_code_key" ON "users"("employee_code");

-- CreateIndex
CREATE INDEX "user_factories_factory_id_idx" ON "user_factories"("factory_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lines_factory_id_code_key" ON "lines"("factory_id", "code");

-- CreateIndex
CREATE INDEX "machines_line_id_idx" ON "machines"("line_id");

-- CreateIndex
CREATE INDEX "machines_factory_id_status_idx" ON "machines"("factory_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "machines_factory_id_code_key" ON "machines"("factory_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_factory_id_name_key" ON "shifts"("factory_id", "name");

-- CreateIndex
CREATE INDEX "operator_assignments_user_id_idx" ON "operator_assignments"("user_id");

-- CreateIndex
CREATE INDEX "operator_assignments_factory_id_idx" ON "operator_assignments"("factory_id");

-- CreateIndex
CREATE UNIQUE INDEX "operator_assignments_machine_id_shift_id_start_date_key" ON "operator_assignments"("machine_id", "shift_id", "start_date");

-- CreateIndex
CREATE INDEX "work_orders_factory_id_status_idx" ON "work_orders"("factory_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_factory_id_order_number_key" ON "work_orders"("factory_id", "order_number");

-- CreateIndex
CREATE INDEX "work_order_assignments_work_order_id_idx" ON "work_order_assignments"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_assignments_line_id_idx" ON "work_order_assignments"("line_id");

-- CreateIndex
CREATE INDEX "work_order_assignments_machine_id_idx" ON "work_order_assignments"("machine_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_events_reverses_event_id_key" ON "production_events"("reverses_event_id");

-- CreateIndex
CREATE INDEX "production_events_factory_id_occurred_at_idx" ON "production_events"("factory_id", "occurred_at");

-- CreateIndex
CREATE INDEX "production_events_machine_id_occurred_at_idx" ON "production_events"("machine_id", "occurred_at");

-- CreateIndex
CREATE INDEX "production_events_work_order_id_idx" ON "production_events"("work_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_events_factory_id_idempotency_key_key" ON "production_events"("factory_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "issues_factory_id_status_idx" ON "issues"("factory_id", "status");

-- CreateIndex
CREATE INDEX "issues_machine_id_opened_at_idx" ON "issues"("machine_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "issues_factory_id_idempotency_key_key" ON "issues"("factory_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "downtime_events_issue_id_key" ON "downtime_events"("issue_id");

-- CreateIndex
CREATE INDEX "downtime_events_machine_id_started_at_idx" ON "downtime_events"("machine_id", "started_at");

-- CreateIndex
CREATE INDEX "downtime_events_factory_id_started_at_idx" ON "downtime_events"("factory_id", "started_at");

-- CreateIndex
CREATE INDEX "quality_checks_factory_id_checked_at_idx" ON "quality_checks"("factory_id", "checked_at");

-- CreateIndex
CREATE INDEX "quality_checks_work_order_id_idx" ON "quality_checks"("work_order_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_factory_id_created_at_idx" ON "audit_logs"("factory_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "factory_settings_factory_id_key_key" ON "factory_settings"("factory_id", "key");

-- AddForeignKey
ALTER TABLE "user_factories" ADD CONSTRAINT "user_factories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_factories" ADD CONSTRAINT "user_factories_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lines" ADD CONSTRAINT "lines_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_reverses_event_id_fkey" FOREIGN KEY ("reverses_event_id") REFERENCES "production_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_events" ADD CONSTRAINT "downtime_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_settings" ADD CONSTRAINT "factory_settings_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
