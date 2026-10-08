import { BadRequestException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

export function parseBody<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

const uuidSchema = z.string().uuid();

export function parseUuid(value: unknown): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new NotFoundException();
  return result.data;
}

export const codeSchema = (min: number) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      new RegExp(`^[A-Z0-9-]{${min},20}$`),
      `Code must be ${min}-20 characters: letters, numbers or dashes`,
    );

export const nameSchema = z.string().trim().min(1).max(120);