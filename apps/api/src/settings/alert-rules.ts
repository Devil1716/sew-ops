import type { Prisma } from '@prisma/client';

export const ALERT_KEY = 'alert_types';
export const ALERT_TYPES = ['machine_issue', 'thread_empty', 'material_missing', 'quality_issue', 'other'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/** Which issue types alert managers. Everything is on until an admin turns it off. */
export async function loadAlertRules(
  db: Prisma.TransactionClient,
  factoryId: string,
): Promise<Record<AlertType, boolean>> {
  const row = await db.factorySetting.findUnique({
    where: { factoryId_key: { factoryId, key: ALERT_KEY } },
  });
  const stored = (row?.value ?? {}) as Record<string, unknown>;
  const rules = {} as Record<AlertType, boolean>;
  for (const type of ALERT_TYPES) {
    rules[type] = typeof stored[type] === 'boolean' ? (stored[type] as boolean) : true;
  }
  return rules;
}

export async function isAlertEnabled(
  db: Prisma.TransactionClient,
  factoryId: string,
  type: string,
): Promise<boolean> {
  if (!(ALERT_TYPES as readonly string[]).includes(type)) return false; // breaks never alert
  const rules = await loadAlertRules(db, factoryId);
  return rules[type as AlertType];
}