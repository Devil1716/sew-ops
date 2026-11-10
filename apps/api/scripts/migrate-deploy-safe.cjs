const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '../../..');
const schema = 'apps/api/prisma/schema.prisma';
const migrations = [
  '20261008102938_init',
  '20261008201611_quality_integrity',
  '20261019082719_add_maintenance_reason',
];

function runPrisma(args, options = {}) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(executable, ['prisma', ...args], {
    cwd: root,
    env: process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: options.capture ? 'utf8' : undefined,
  });

  if (result.error) throw result.error;
  return result;
}

async function main() {
  if (!process.env.DIRECT_URL) {
    throw new Error('DIRECT_URL is required for production migrations.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });

  let hasAppliedMigrationHistory = false;
  try {
    const [migrationTable] = await prisma.$queryRaw`
      SELECT to_regclass('public._prisma_migrations')::text AS table_name
    `;

    if (migrationTable.table_name) {
      const [history] = await prisma.$queryRaw`
        SELECT EXISTS (SELECT 1 FROM public._prisma_migrations) AS has_rows
      `;
      hasAppliedMigrationHistory = history.has_rows;
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!hasAppliedMigrationHistory) {
    console.log('No Prisma migration history found; checking the existing production schema before baselining.');
    const diff = runPrisma([
      'migrate',
      'diff',
      '--from-url',
      process.env.DIRECT_URL,
      '--to-schema-datamodel',
      schema,
      '--exit-code',
    ], { capture: true });

    if (diff.status !== 0) {
      throw new Error(
        'Production schema differs from the current Prisma schema. Refusing to baseline automatically; inspect the database before applying migrations.',
      );
    }

    console.log('Production schema matches the Prisma schema; recording the existing migrations as applied.');
    for (const migration of migrations) {
      const result = runPrisma(['migrate', 'resolve', '--applied', migration, '--schema', schema]);
      if (result.status !== 0) throw new Error(`Could not baseline migration ${migration}.`);
    }
  }

  const result = runPrisma(['migrate', 'deploy', '--schema', schema]);
  if (result.status !== 0) throw new Error('Prisma migrate deploy failed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Production migration preflight failed.');
  process.exitCode = 1;
});
