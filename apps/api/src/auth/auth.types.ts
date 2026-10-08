import type { Request } from 'express';
import type { Role } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  factoryIds: string[];
}

export interface AuthUser extends PublicUser {
  sessionId: string;
}

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export type RequestWithUser = Request & { user?: AuthUser };