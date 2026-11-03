export interface EnvReport {
  errors: string[];
  warnings: string[];
}

/**
 * Validates the environment variables required by the SewOps API.
 * In production, any validation failure throws an error and prevents server boot.
 * In development, issues are logged as warnings.
 */
export function inspectEnvironment(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const production = env.NODE_ENV === 'production';
  const problems: string[] = [];

  const database = env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(database)) {
    problems.push('DATABASE_URL must be a valid postgres:// or postgresql:// connection string.');
  }

  if (env.DIRECT_URL && !/^postgres(ql)?:\/\//.test(env.DIRECT_URL)) {
    problems.push('DIRECT_URL must be a valid postgres:// or postgresql:// connection string.');
  }

  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32) {
    problems.push('JWT_ACCESS_SECRET must be at least 32 characters.');
  }

  const cors = env.CORS_ORIGIN ?? '';
  if (cors.length === 0 || cors.includes('*')) {
    problems.push('CORS_ORIGIN must be set to the exact website address(es) (comma-separated, no wildcards).');
  }

  if (env.PORT && !/^\d+$/.test(env.PORT)) {
    problems.push('PORT must be an integer.');
  }

  if (env.COOKIE_DOMAIN && /[:/\s]/.test(env.COOKIE_DOMAIN)) {
    problems.push('COOKIE_DOMAIN must be a bare domain such as .example.com (no http://, port or slash).');
  }

  const productionOnly: string[] = [];
  if (production) {
    const origins = cors.split(',').map((o) => o.trim()).filter(Boolean);
    if (!origins.every((origin) => origin.startsWith('https://'))) {
      productionOnly.push('CORS_ORIGIN must use https:// in production.');
    }
    if (/localhost|127\.0\.0\.1/.test(cors) && env.ALLOW_LOCALHOST_ORIGIN !== 'true') {
      productionOnly.push('CORS_ORIGIN must not point to localhost in production.');
    }
    if (/change|example|test|password|secret/i.test(secret)) {
      productionOnly.push('JWT_ACCESS_SECRET must not use a default/placeholder secret.');
    }
  }

  return production
    ? { errors: [...problems, ...productionOnly], warnings: [] }
    : { errors: [], warnings: problems };
}

export function runEnvironmentCheck(): boolean {
  const { errors, warnings } = inspectEnvironment();
  for (const w of warnings) {
    console.warn(`[SewOps Env Warning] ${w}`);
  }
  if (errors.length > 0) {
    throw new Error(`Refusing to start: fix the required environment variables.\n - ${errors.join('\n - ')}`);
  }
  return true;
}
