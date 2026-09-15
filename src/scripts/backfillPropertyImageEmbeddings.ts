/**
 * Backfill CLIP embeddings for live listing photos and ensure the Atlas vector index.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/backfillPropertyImageEmbeddings.ts
 * Optional env:
 *   BACKFILL_LIMIT=50   — listings to process this run (default 50)
 *   BACKFILL_ALL=1      — keep looping until a pass embeds nothing new
 */
import "dotenv/config";
import mongoose from "mongoose";

// This script exists to generate embeddings — always load CLIP unless explicitly disabled.
if (process.env.PROPERTY_IMAGE_CLIP_ENABLED === undefined) {
  process.env.PROPERTY_IMAGE_CLIP_ENABLED = "true";
}
import { DB } from "../controllers";
import {
  backfillLiveListingImageEmbeddings,
  ensurePropertyImageVectorIndex,
} from "../services/propertyImageEmbedding.service";

async function run() {
  await mongoose.connect(process.env.MONGO_URL!);
  console.log("Connected to MongoDB");

  void DB.Models.PropertyImageEmbedding;

  console.log("Step 1/2: Atlas vector index (skipped if it hangs)...");
  await ensurePropertyImageVectorIndex();

  const limit = Math.max(1, Number(process.env.BACKFILL_LIMIT) || 10);
  const all = process.env.BACKFILL_ALL === "1";
  let totalProcessed = 0;
  let totalEmbedded = 0;
  let totalSkipped = 0;

  console.log(`Step 2/2: Embedding live listing photos (limit=${limit})...`);
  do {
    const result = await backfillLiveListingImageEmbeddings({ limit });
    totalProcessed += result.processed;
    totalEmbedded += result.embedded;
    totalSkipped += result.skipped;
    console.log(
      `Pass: processed=${result.processed} embedded=${result.embedded} skipped=${result.skipped}`,
    );
    if (!all || result.embedded === 0) break;
  } while (true);

  console.log(
    `Done. processed=${totalProcessed} embedded=${totalEmbedded} skipped=${totalSkipped}`,
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
