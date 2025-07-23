import "dotenv/config";
console.log("DEBUG: MONGO_URL at script start:", process.env.MONGO_URL);

import mongoose from "mongoose";
import dotenv from "dotenv";
import { DB } from "../controllers";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL!);
    console.log("Connected to MongoDB");

    const propertyModel = DB.Models.Property;

    const properties = await propertyModel.find({
      $or: [
        { isDeleted: { $exists: false } },
        { isApproved: { $exists: true } },
        { status: { $exists: false } },
      ],
    });

    let updatedCount = 0;

    for (const prop of properties) {
      const isApproved = prop.isApproved === true;
      const status = isApproved ? "approved" : "pending";

      const update: any = {
        isDeleted: prop.isDeleted ?? false,
        status,
      };

      await propertyModel.updateOne({ _id: prop._id }, { $set: update });
      updatedCount++;
    }

    console.log(`${updatedCount} properties updated based on approval logic.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

run();
