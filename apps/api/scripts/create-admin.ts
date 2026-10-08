import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

function fail(msg: string): never {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

function need(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) fail(`Missing ${name}`);
  return v;
}

async function main() {
  const factoryName = need('FACTORY_NAME');
  const factoryCode = need('FACTORY_CODE').toUpperCase();
  const adminName = need('ADMIN_NAME');
  const email = need('ADMIN_EMAIL').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const timezone = (process.env.FACTORY_TZ ?? '').trim() || 'Asia/Kolkata';

  if (!/^[A-Z0-9-]{2,20}$/.test(factoryCode)) {
    fail('Factory code must be 2-20 characters: letters, numbers or dashes only.');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail('That does not look like a valid email address.');
  }
  if (password.length < 12) {
    fail('Password must be at least 12 characters.');
  }

  const admins = await prisma.user.count({ where: { role: 'admin' } });
  if (admins > 0) {
    fail('An admin account already exists. This setup can only run once.');
  }

  const passwordHash = await hash(password);

  const result = await prisma.$transaction(async (tx) => {
    const factory = await tx.factory.create({
      data: { name: factoryName, code: factoryCode, timezone },
    });
    const user = await tx.user.create({
      data: { name: adminName, email, passwordHash, role: 'admin' },
    });
    await tx.userFactory.create({
      data: { userId: user.id, factoryId: factory.id },
    });
    await tx.auditLog.create({
      data: {
        factoryId: factory.id,
        actorId: user.id,
        action: 'bootstrap.admin_created',
        entityType: 'user',
        entityId: user.id,
        after: { email, role: 'admin' },
      },
    });
    return { factory, user };
  });

  console.log('\nSetup complete.');
  console.log(`Factory : ${result.factory.name} (${result.factory.code})`);
  console.log(`Admin   : ${result.user.name} <${result.user.email}>`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());