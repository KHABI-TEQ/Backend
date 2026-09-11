/**
 * Remap leftover listing statuses `active` / `inactive` to the live-on-market model:
 * - active → approved
 * - inactive / inActive → unavailable (and isAvailable false)
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/migratePropertyActiveStatus.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");

  const Property = DB.Models.Property;

  const activeResult = await Property.updateMany(
    { status: "active" },
    { $set: { status: "approved" } },
  );
  console.log(
    `active → approved: matched=${activeResult.matchedCount} modified=${activeResult.modifiedCount}`,
  );

  const inactiveResult = await Property.updateMany(
    { status: { $in: ["inactive", "inActive"] } },
    { $set: { status: "unavailable", isAvailable: false } },
  );
  console.log(
    `inactive → unavailable: matched=${inactiveResult.matchedCount} modified=${inactiveResult.modifiedCount}`,
  );

  await mongoose.disconnect();
  console.log("Done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
