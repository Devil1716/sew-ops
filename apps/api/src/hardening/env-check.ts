export interface EnvReport {
  errors: string[];
  warnings: string[];
}

/** Checks the settings the API needs. In production a problem stops the start; in development it only warns. */
export function inspectEnvironment(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const production = env.NODE_ENV === 'production';
  const problems: string[] = [];

  const database = env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(database)) problems.push('DATABASE_URL must be a postgres:// connection string.');

  const secret = env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32) problems.push('JWT_ACCESS_SECRET must be at least 32 characters.');

  const cors = env.CORS_ORIGIN ?? '';
  if (cors.length === 0 || cors.includes('*')) {
    problems.push('CORS_ORIGIN must be set to the website address (no wildcard).');
  }

  if (env.PORT && !/^\d+$/.test(env.PORT)) problems.push('PORT must be a number.');
  if (env.COOKIE_DOMAIN && /[:/\s]/.test(env.COOKIE_DOMAIN)) {
    problems.push('COOKIE_DOMAIN must be a bare domain such as .example.com (no http://, port or slash).');
  }

  const productionOnly: string[] = [];
  if (production) {
    if (!cors.split(',').every((origin) => origin.trim().startsWith('https://'))) {
      productionOnly.push('CORS_ORIGIN must use https:// in production.');
    }
    if (/localhost|127\.0\.0\.1/.test(cors) && env.ALLOW_LOCALHOST_ORIGIN !== 'true') productionOnly.push('CORS_ORIGIN still points at localhost.');
    if (/change|example|test|password|secret/i.test(secret)) {
      productionOnly.push('JWT_ACCESS_SECRET looks like a placeholder.');
    }
  }

  return production
    ? { errors: [...problems, ...productionOnly], warnings: [] }
    : { errors: [], warnings: problems };
}

export function runEnvironmentCheck(): boolean {
  const { errors, warnings } = inspectEnvironment();
  for (const w of warnings) console.warn(`[env] warning: ${w}`);
  if (errors.length > 0) {
    throw new Error(`Refusing to start: fix the environment first.\n - ${errors.join('\n - ')}`);
  }
  return true;
}