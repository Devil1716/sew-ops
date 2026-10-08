import { NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';

/** 404 (not 403) so we never reveal that another factory's record exists. */
export function assertFactoryAccess(user: AuthUser, factoryId: string) {
  if (!user.factoryIds.includes(factoryId)) throw new NotFoundException();
}