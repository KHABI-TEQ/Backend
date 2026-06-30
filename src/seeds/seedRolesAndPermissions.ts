import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  DEFAULT_ROLES,
} from "../common/constants/permissions";
import { DB } from "../controllers";

dotenv.config();

/**
 * Seed script to initialize roles and permissions
 * Run this once after database setup (safe to re-run — adds missing items only)
 *
 * Usage (from backend root):
 * npx ts-node -r dotenv/config src/seeds/seedRolesAndPermissions.ts
 */

async function loadPermissionMap(): Promise<Map<string, string>> {
  const allPermissions = await DB.Models.Permission.find({});
  return new Map(allPermissions.map((p) => [p.name, p._id.toString()]));
}

async function ensurePermissions(): Promise<Map<string, string>> {
  console.log("🔐 Ensuring permissions exist...");

  const permissionMap = await loadPermissionMap();
  const missing = Object.values(PERMISSIONS).filter((name) => !permissionMap.has(name));

  if (missing.length === 0) {
    console.log(`   ✅ All ${permissionMap.size} permissions already present.`);
    return permissionMap;
  }

  const created = await DB.Models.Permission.insertMany(
    missing.map((permissionName) => ({
      name: permissionName,
      description:
        PERMISSION_DESCRIPTIONS[permissionName as keyof typeof PERMISSION_DESCRIPTIONS],
      resource: permissionName.split(".")[0],
      action: permissionName.split(".")[1],
      category: permissionName.split(".")[0],
      isActive: true,
    })),
  );

  created.forEach((p) => permissionMap.set(p.name, p._id.toString()));
  console.log(`   ✅ Created ${created.length} missing permission(s).`);
  return permissionMap;
}

async function ensureRoles(permissionMap: Map<string, string>): Promise<void> {
  console.log("👥 Ensuring roles exist...");

  let createdCount = 0;

  for (const roleTemplate of Object.values(DEFAULT_ROLES) as Array<{
    name: string;
    description: string;
    level: number;
    permissions: readonly string[];
  }>) {
    const existing = await DB.Models.Role.findOne({ name: roleTemplate.name });
    if (existing) continue;

    const role = await DB.Models.Role.create({
      name: roleTemplate.name,
      description: roleTemplate.description,
      level: roleTemplate.level,
      permissions: roleTemplate.permissions
        .map((permName) => permissionMap.get(permName))
        .filter((id): id is string => !!id),
      isActive: true,
    });

    createdCount += 1;
    console.log(
      `   ✅ Created role: ${role.name} (Level ${role.level}, ${role.permissions.length} permissions)`,
    );
  }

  if (createdCount === 0) {
    const total = await DB.Models.Role.countDocuments();
    console.log(`   ✅ All ${total} roles already present.`);
  }
}

async function seedLasreraAdmin(): Promise<void> {
  console.log("👤 Ensuring LASRERA admin account exists...");

  const lasreraAdminRole = await DB.Models.Role.findOne({ name: "lasrera-admin" });
  if (!lasreraAdminRole) {
    console.log("   ❌ lasrera-admin role still missing. Cannot create LASRERA admin.");
    return;
  }

  const lasreraSeedEmail =
    process.env.LASRERA_ADMIN_EMAIL?.toLowerCase().trim() || "lasrera.admin@khabiteq.com";
  const lasreraSeedPassword = (process.env.LASRERA_ADMIN_PASSWORD || "Lasrera@12345").trim();
  const shouldResetPassword =
    String(process.env.LASRERA_ADMIN_RESET_PASSWORD || "").toLowerCase() === "true";

  const existingAdmin = await DB.Models.Admin.findOne({ email: lasreraSeedEmail });
  if (existingAdmin) {
    const hasRole = existingAdmin.roles?.some(
      (roleId) => roleId.toString() === lasreraAdminRole._id.toString(),
    );
    if (!hasRole) {
      const roleIds = (existingAdmin.roles || []).map((id) => String(id));
      existingAdmin.roles = [...roleIds, String(lasreraAdminRole._id)];
    }

    if (!existingAdmin.password || shouldResetPassword) {
      const passwordHash = await bcrypt.hash(lasreraSeedPassword, 10);
      await DB.Models.Admin.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            password: passwordHash,
            roles: existingAdmin.roles,
            isActive: true,
            isAccountVerified: true,
            isVerified: true,
          },
        },
      );
      console.log(
        `   ✅ ${shouldResetPassword ? "Reset" : "Set"} password for ${lasreraSeedEmail}`,
      );
      return;
    }

    if (!hasRole) {
      await existingAdmin.save();
      console.log(`   ✅ Updated ${lasreraSeedEmail} with lasrera-admin role.`);
      return;
    }

    console.log(`   ⚠️  ${lasreraSeedEmail} already exists. Skipping.`);
    console.log(
      "      To reset password, run with LASRERA_ADMIN_RESET_PASSWORD=true",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(lasreraSeedPassword, 10);
  await DB.Models.Admin.create({
    email: lasreraSeedEmail,
    password: passwordHash,
    firstName: "LASRERA",
    lastName: "Admin",
    phoneNumber: "+2348040000000",
    roles: [lasreraAdminRole._id],
    profile_picture: "",
    isVerified: true,
    isAccountVerified: true,
    isActive: true,
  });

  console.log(`   ✅ Created LASRERA admin: ${lasreraSeedEmail}`);
}

async function seedSampleAdmins(): Promise<void> {
  console.log("👤 Ensuring sample KHABITEQ admin accounts exist...");

  const adminRole = await DB.Models.Role.findOne({ name: "admin" });
  const managerRole = await DB.Models.Role.findOne({ name: "manager" });

  const sampleAdmins = [
    {
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      phoneNumber: "+234801234567",
      roles: [] as mongoose.Types.ObjectId[],
    },
    ...(adminRole
      ? [
          {
            email: "admin@example.com",
            firstName: "Admin",
            lastName: "User",
            phoneNumber: "+234802234567",
            roles: [adminRole._id],
          },
        ]
      : []),
    ...(managerRole
      ? [
          {
            email: "manager@example.com",
            firstName: "Manager",
            lastName: "User",
            phoneNumber: "+234803234567",
            roles: [managerRole._id],
          },
        ]
      : []),
  ];

  for (const adminData of sampleAdmins) {
    const existingAdmin = await DB.Models.Admin.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log(`   ⚠️  ${adminData.email} already exists. Skipping.`);
      continue;
    }

    await DB.Models.Admin.create({
      ...adminData,
      profile_picture: "",
      isVerified: true,
      isAccountVerified: true,
      isActive: true,
    });
    console.log(`   ✅ Created: ${adminData.email}`);
  }
}

async function main() {
  try {
    const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/khabi-teq";
    console.log(`\n🔗 Connecting to MongoDB: ${mongoUri}\n`);

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    const permissionMap = await ensurePermissions();
    await ensureRoles(permissionMap);
    await seedSampleAdmins();
    await seedLasreraAdmin();

    const lasreraSeedEmail =
      process.env.LASRERA_ADMIN_EMAIL?.toLowerCase().trim() || "lasrera.admin@khabiteq.com";

    console.log("\n✅ Database seeding completed successfully!\n");
    console.log("LASRERA Admin login:");
    console.log(`  Email:    ${lasreraSeedEmail}`);
    console.log(
      `  Password: ${process.env.LASRERA_ADMIN_PASSWORD ? "[from LASRERA_ADMIN_PASSWORD env]" : "Lasrera@12345"}\n`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
