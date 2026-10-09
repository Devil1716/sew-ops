import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date (use YYYY-MM-DD)');

export const rangeQuerySchema = z.object({
  factoryId: z.string().uuid().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

/** Both dates are inclusive calendar days in the factory's own timezone. */
export function resolveRange(timeZone: string, from?: string, to?: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const f = from ?? to ?? today;
  const t = to ?? from ?? today;
  if (f > t) throw new BadRequestException('"from" must be on or before "to".');
  const days = (Date.parse(`${t}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > 92) throw new BadRequestException('Reports are limited to 92 days at a time.');
  return { from: f, to: t };
}