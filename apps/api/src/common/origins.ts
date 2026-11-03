export function allowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  // Development fallback only
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000'];
  }

  return [];
}
