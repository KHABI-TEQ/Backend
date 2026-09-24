/**
 * Portfolio Unlimited is retired. This script deactivates leftover SKUs.
 *
 * Run: npm run ensure-portfolio-unlimited-plan
 */
import "dotenv/config";
import mongoose from "mongoose";
import { DB } from "../controllers";
import { RETIRED_UNLIMITED_LISTINGS_PLAN_CODES } from "../common/constants/publisherListingLimits";

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");
  void DB.Models.SubscriptionPlan;

  const result = await DB.Models.SubscriptionPlan.updateMany(
    { code: { $in: [...RETIRED_UNLIMITED_LISTINGS_PLAN_CODES] } },
    { $set: { isActive: false, hiddenFromCatalog: true, unlimitedListings: false } }
  );
  console.log(`Retired ${result.modifiedCount} Portfolio Unlimited plan(s).`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
