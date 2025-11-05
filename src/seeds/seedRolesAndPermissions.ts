import mongoose from 'mongoose';
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, DEFAULT_ROLES } from '../common/constants/permissions';
import { DB } from '../controllers';

/**
 * Seed script to initialize roles and permissions
 * Run this once after database setup
 *
 * Usage:
 * npx ts-node backend/seeds/seedRolesAndPermissions.ts
 */

async function seedPermissions(): Promise<Map<string, string>> {
  console.log('🔐 Seeding permissions...');

  const existingCount = await DB.Models.Permission.countDocuments();

  if (existingCount > 0) {
    console.log(`⚠️  ${existingCount} permissions already exist. Skipping permission seed.`);
    const allPermissions = await DB.Models.Permission.find({});
    return new Map(allPermissions.map((p) => [p.name, p._id.toString()]));
  }

  const permissionsToCreate = Object.entries(PERMISSIONS).map(([key, permissionName]) => ({
    name: permissionName,
    description: PERMISSION_DESCRIPTIONS[permissionName as keyof typeof PERMISSION_DESCRIPTIONS],
    resource: permissionName.split('.')[0],
    action: permissionName.split('.')[1],
    category: permissionName.split('.')[0],
    isActive: true,
  }));

  const createdPermissions = await DB.Models.Permission.insertMany(permissionsToCreate);
  console.log(`✅ Created ${createdPermissions.length} permissions`);

  return new Map(createdPermissions.map((p) => [p.name, p._id.toString()]));
}

async function seedRoles(permissionMap: Map<string, string>): Promise<void> {
  console.log('👥 Seeding roles...');

  const existingCount = await DB.Models.Role.countDocuments();

  if (existingCount > 0) {
    console.log(`⚠️  ${existingCount} roles already exist. Skipping role seed.`);
    return;
  }

  const rolesToCreate = Object.values(DEFAULT_ROLES).map((roleTemplate: any) => ({
    name: roleTemplate.name,
    description: roleTemplate.description,
    level: roleTemplate.level,
    permissions: roleTemplate.permissions
      .map((permName: string) => permissionMap.get(permName))
      .filter((id: string): id is string => !!id),
    isActive: true,
  }));

  const createdRoles = await DB.Models.Role.insertMany(rolesToCreate);
  console.log(`✅ Created ${createdRoles.length} roles`);

  // Print role summaries
  createdRoles.forEach((role) => {
    console.log(
      `   - ${role.name.padEnd(20)} (Level ${role.level}, ${role.permissions.length} permissions)`
    );
  });
}

async function seedSampleAdmin(permissionMap: Map<string, string>): Promise<void> {
  console.log('👤 Setting up sample admin accounts...');


  // Get role IDs
  const adminRole = await DB.Models.Role.findOne({ name: 'admin' });
  const managerRole = await DB.Models.Role.findOne({ name: 'manager' });

  if (!adminRole || !managerRole) {
    console.log('⚠️  Roles not found. Skipping sample admin setup.');
    return;
  }

  // Sample data
  const sampleAdmins = [
    {
      email: 'superadmin@example.com',
      firstName: 'Super',
      lastName: 'Admin',
      phoneNumber: '+234801234567',
      role: 'superAdmin',
      roles: [],
      profile_picture: '',
      isVerified: true,
      isAccountVerified: true,
      isActive: true,
    },
    {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      phoneNumber: '+234802234567',
      role: 'admin',
      roles: [adminRole._id],
      profile_picture: '',
      isVerified: true,
      isAccountVerified: true,
      isActive: true,
    },
    {
      email: 'manager@example.com',
      firstName: 'Manager',
      lastName: 'User',
      phoneNumber: '+234803234567',
      role: 'admin',
      roles: [managerRole._id],
      profile_picture: '',
      isVerified: true,
      isAccountVerified: true,
      isActive: true,
    },
  ];

  for (const adminData of sampleAdmins) {
    const existingAdmin = await DB.Models.Admin.findOne({ email: adminData.email });

    if (existingAdmin) {
      console.log(`   ⚠️  ${adminData.email} already exists. Skipping.`);
      continue;
    }

    const newAdmin = new (DB.Models.Admin)(adminData);
    await newAdmin.save();
    console.log(`   ✅ Created: ${adminData.email} with role(s): ${adminData.roles.length > 0 ? (adminData.roles as any).join(', ') : 'superAdmin'}`);
  }
}

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/khabi-teq';
    console.log(`\n🔗 Connecting to MongoDB: ${mongoUri}\n`);

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Seed permissions
    const permissionMap = await seedPermissions();

    // Seed roles
    await seedRoles(permissionMap);

    // Seed sample admins
    await seedSampleAdmin(permissionMap);

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('Sample Admin Accounts:');
    console.log('  1. superadmin@example.com (Super Admin - Full Access)');
    console.log('  2. admin@example.com (Admin Role)');
    console.log('  3. manager@example.com (Manager Role)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  } 
}

main();
