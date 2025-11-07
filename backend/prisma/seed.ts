import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Skip default setup if environment variable is set
  if (process.env.SKIP_DEFAULT_SEED === 'true') {
    console.log('🌱 Default seed skipped (SKIP_DEFAULT_SEED=true)');
    return;
  }

  console.log('🌱 Starting default setup seed...');

  // 1. Create GlobalSettings (singleton)
  const globalSettings = await prisma.globalSettings.upsert({
    where: { singleton: true },
    update: {},
    create: {
      singleton: true,
      wahaHost: process.env.DEFAULT_WAHA_HOST || '',
      wahaApiKey: process.env.DEFAULT_WAHA_API_KEY || '',
      companyName: process.env.DEFAULT_COMPANY_NAME || 'Astra Campaign',
      pageTitle: process.env.DEFAULT_PAGE_TITLE || 'Sistema de Gestão de Contatos',
      logoUrl: process.env.DEFAULT_LOGO_URL || null,
      faviconUrl: process.env.DEFAULT_FAVICON_URL || null,
      primaryColor: process.env.DEFAULT_PRIMARY_COLOR || '#3B82F6',
    }
  });

  console.log('✅ GlobalSettings created/updated');

  // 2. Create default tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'astraonline1' },
    update: {},
    create: {
      slug: 'astraonline1',
      name: 'Astraonline1',
      active: true,
    }
  });

  console.log('✅ Default tenant created: Astraonline1');

  // 3. Create quotas for default tenant
  const defaultQuotas = await prisma.tenantQuota.upsert({
    where: { tenantId: defaultTenant.id },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      maxUsers: 100,
      maxContacts: 10000,
      maxCampaigns: 500,
      maxConnections: 50,
    }
  });

  console.log('✅ Default tenant quotas created');

  // 4. Create default tenant settings
  const defaultTenantSettings = await prisma.tenantSettings.upsert({
    where: { tenantId: defaultTenant.id },
    update: {},
    create: {
      tenantId: defaultTenant.id,
      openaiApiKey: null,
      groqApiKey: null,
      customBranding: undefined,
    }
  });

  console.log('✅ Default tenant settings created');

  // 5. Create SUPERADMIN user
  const superAdminPassword = await bcrypt.hash('Admin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@astraonline.com.br' },
    update: {
      role: 'SUPERADMIN',
      tenantId: null,
      senha: superAdminPassword,
    },
    create: {
      nome: 'Super Administrador',
      email: 'superadmin@astraonline.com.br',
      senha: superAdminPassword,
      role: 'SUPERADMIN',
      tenantId: null,
      ativo: true,
    }
  });

  console.log('✅ SUPERADMIN created: superadmin@astraonline.com.br');

  // 6. Create default ADMIN user for the tenant
  const adminPassword = await bcrypt.hash('Admin123', 12);
  const defaultAdmin = await prisma.user.upsert({
    where: { email: 'admin@astraonline.com.br' },
    update: {
      role: 'ADMIN',
      tenantId: defaultTenant.id,
      senha: adminPassword,
    },
    create: {
      nome: 'Administrador',
      email: 'admin@astraonline.com.br',
      senha: adminPassword,
      role: 'ADMIN',
      tenantId: defaultTenant.id,
      ativo: true,
    }
  });

  console.log('✅ Default ADMIN created: admin@astraonline.com.br');

  // 6.1. Create UserTenant associations
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: superAdmin.id,
        tenantId: defaultTenant.id
      }
    },
    update: {},
    create: {
      userId: superAdmin.id,
      tenantId: defaultTenant.id,
      role: 'SUPERADMIN'
    }
  });

  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: defaultAdmin.id,
        tenantId: defaultTenant.id
      }
    },
    update: {},
    create: {
      userId: defaultAdmin.id,
      tenantId: defaultTenant.id,
      role: 'ADMIN'
    }
  });

  console.log('✅ User-Tenant associations created');

  // 7. Migrate existing data to default tenant if any
  const existingUsersWithoutTenant = await prisma.user.findMany({
    where: {
      tenantId: null,
      role: { not: 'SUPERADMIN' }
    }
  });

  if (existingUsersWithoutTenant.length > 0) {
    await prisma.user.updateMany({
      where: {
        tenantId: null,
        role: { not: 'SUPERADMIN' }
      },
      data: {
        tenantId: defaultTenant.id
      }
    });
    console.log(`✅ Migrated ${existingUsersWithoutTenant.length} existing users to default tenant`);
  }

  // 8. Migrate existing data to default tenant
  const tablesToMigrate = [
    { table: 'contact', count: 0 },
    { table: 'campaign', count: 0 },
    { table: 'campaignMessage', count: 0 },
    { table: 'whatsAppSession', count: 0 },
  ];

  for (const { table } of tablesToMigrate) {
    const result = await (prisma as any)[table].updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id }
    });
    console.log(`✅ Migrated ${result.count} existing ${table} records to default tenant`);
  }

  console.log('🎉 Default setup completed successfully!');
  console.log('📋 Summary:');
  console.log(`   - Default Tenant: ${defaultTenant.slug} (${defaultTenant.name})`);
  console.log(`   - SUPERADMIN: superadmin@astraonline.com.br / Admin123`);
  console.log(`   - Default ADMIN: admin@astraonline.com.br / Admin123`);
  console.log(`   - Global Settings: Created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });