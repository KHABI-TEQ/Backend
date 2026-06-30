import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { DB } from "../controllers";

dotenv.config();

const EMAIL = (
  process.env.LASRERA_ADMIN_EMAIL?.toLowerCase().trim() || "lasrera.admin@khabiteq.com"
);

async function main() {
  const mongoUri = process.env.MONGO_URL || "mongodb://localhost:27017/khabi-teq";
  const dbName = mongoUri.includes("/production") ? "production" : "other";

  await mongoose.connect(mongoUri);

  const admin = await DB.Models.Admin.findOne({ email: EMAIL });
  const plainFromEnv = (process.env.LASRERA_ADMIN_PASSWORD || "Lasrera@12345").trim();

  console.log("\nLASRERA admin login diagnostic");
  console.log("==============================");
  console.log(`Database target: ${dbName}`);
  console.log(`Email checked:   ${EMAIL}`);
  console.log(`Admin found:     ${!!admin}`);

  if (!admin) {
    console.log("Result: NO_ADMIN — account does not exist in this database.");
    process.exit(1);
  }

  const hash = admin.password || "";
  console.log(`Has password:    ${!!hash}`);
  console.log(`Hash prefix:     ${hash ? hash.slice(0, 7) : "none"}`);
  console.log(`isActive:        ${admin.isActive}`);
  console.log(`isVerified:      ${admin.isAccountVerified}`);

  const candidates = [
    { label: "LASRERA_ADMIN_PASSWORD (trimmed)", value: plainFromEnv },
    { label: "Lasrera@12345", value: "Lasrera@12345" },
  ];

  let anyMatch = false;
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const match = await bcrypt.compare(candidate.value, hash);
    console.log(`Password match (${candidate.label}): ${match}`);
    if (match) anyMatch = true;
  }

  console.log(`\nOverall: ${anyMatch ? "PASSWORD_OK for at least one candidate" : "PASSWORD_MISMATCH"}\n`);
  process.exit(anyMatch ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await mongoose.disconnect();
});
