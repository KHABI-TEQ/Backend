import { IUserSubscriptionSnapshotDoc } from "../models";
import { DB } from "../controllers";
import mongoose, { FilterQuery, UpdateQuery } from "mongoose";

export class UserSubscriptionSnapshotService {
  private static SnapshotModel = DB.Models.UserSubscriptionSnapshot;

  /**
   * Create a subscription snapshot for a user
   */
  static async createSnapshot({
    user,
    plan,
    status = "pending",
    expiresAt,
    features = [],
    transaction,
    autoRenew = false,
    meta = {},
    }: {
    user: string | mongoose.Types.ObjectId;
    plan: string | mongoose.Types.ObjectId;
    status?: "pending" | "active" | "inactive" | "cancelled" | "expired";
    expiresAt: Date;
    features?: {
        feature: string | mongoose.Types.ObjectId;
        type: "boolean" | "count" | "unlimited";
        value?: number;
        remaining?: number;
    }[];
    transaction: string | mongoose.Types.ObjectId;
    autoRenew?: boolean;
    meta?: Record<string, any>;
    }): Promise<IUserSubscriptionSnapshotDoc> {
    const snapshot = new this.SnapshotModel({
        user: typeof user === "string" ? new mongoose.Types.ObjectId(user) : user,
        plan: typeof plan === "string" ? new mongoose.Types.ObjectId(plan) : plan,
        status,
        startedAt: new Date(),
        expiresAt,
        features: features.map((f) => ({
        ...f,
        feature:
            typeof f.feature === "string"
            ? new mongoose.Types.ObjectId(f.feature)
            : f.feature,
        })),
        transaction:
        typeof transaction === "string"
            ? new mongoose.Types.ObjectId(transaction)
            : transaction,
        autoRenew,
        meta,
    });

    return snapshot.save();
    }

 
  /**
   * Update snapshot dynamically
   */
  static async updateSnapshot(
    snapshotId: string,
    updates: UpdateQuery<IUserSubscriptionSnapshotDoc>
  ): Promise<IUserSubscriptionSnapshotDoc | null> {
    return this.SnapshotModel.findByIdAndUpdate(snapshotId, updates, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Get snapshot by ID
   */
  static async getSnapshotById(
    snapshotId: string
  ): Promise<IUserSubscriptionSnapshotDoc | null> {
    return this.SnapshotModel.findById(snapshotId);
  }

  /**
   * Deduct or add usage from a feature
   * @param snapshotId 
   * @param featureId 
   * @param amount positive = deduct, negative = add back
   */
  static async adjustFeatureUsage(
    snapshotId: string,
    featureId: string,
    amount: number = 1
  ): Promise<IUserSubscriptionSnapshotDoc> {
    const snapshot = await this.SnapshotModel.findById(snapshotId);
    if (!snapshot) throw new Error("Subscription snapshot not found");

    const feature = snapshot.features?.find(
      (f) => f.feature.toString() === featureId.toString()
    );
    if (!feature) throw new Error("Feature not found in subscription snapshot");

    switch (feature.type) {
      case "count":
        if ((feature.remaining ?? 0) < amount && amount > 0) {
          throw new Error("Insufficient quota for this feature");
        }
        feature.remaining = (feature.remaining ?? 0) - amount;
        break;

      case "boolean":
        if (amount > 0 && feature.value !== 1) {
          throw new Error("This feature is not enabled");
        }
        break;

      case "unlimited":
        // do nothing
        break;
    }

    await snapshot.save();
    return snapshot;
  }


  /**
   * Adjust usage by feature key instead of ObjectId
   * @param snapshotId 
   * @param featureKey string (e.g. "property_posting")
   * @param amount positive = deduct, negative = add back
   */
  static async adjustFeatureUsageByKey(
    snapshotId: string,
    featureKey: string,
    amount: number = 1
  ): Promise<IUserSubscriptionSnapshotDoc> {
    const snapshot = await this.SnapshotModel.findById(snapshotId).populate(
      "features.feature",
      "key label"
    );
    if (!snapshot) throw new Error("Subscription snapshot not found");

    const feature = snapshot.features?.find(
      (f: any) => f.feature && f.feature.key === featureKey
    );

    if (!feature) throw new Error(`Feature '${featureKey}' not found in subscription snapshot`);

    switch (feature.type) {
      case "count":
        if ((feature.remaining ?? 0) < amount && amount > 0) {
          throw new Error(`Insufficient quota for feature '${featureKey}'`);
        }
        feature.remaining = (feature.remaining ?? 0) - amount;
        break;

      case "boolean":
        if (amount > 0 && feature.value !== 1) {
          throw new Error(`Feature '${featureKey}' is not enabled`);
        }
        break;

      case "unlimited":
        // no changes needed
        break;
    }

    await snapshot.save();
    return snapshot;
  }



  /**
   * Get all snapshots for a user with filters
   */
  static async getUserSnapshots(
    userId: string,
    filters: FilterQuery<IUserSubscriptionSnapshotDoc> = {},
    options: { sort?: any; limit?: number; skip?: number } = {}
  ): Promise<IUserSubscriptionSnapshotDoc[]> {
    return this.SnapshotModel.find({ user: userId, ...filters })
      .sort(options.sort || { createdAt: -1 })
      .limit(options.limit || 0)
      .skip(options.skip || 0);
  }

  /**
   * Remove cancelled complimentary days from stored snapshots so end dates
   * match the purchased plan duration only.
   */
  static async stripComplimentaryBonusValidity(userId?: string): Promise<void> {
    const filter: FilterQuery<IUserSubscriptionSnapshotDoc> = {};
    if (userId) {
      filter.user = userId;
    } else {
      filter.$or = [
        { "meta.bonusDays": { $gt: 0 } },
        { "meta.baseDurationInDays": { $gt: 0 } },
      ];
    }

    const docs = await this.SnapshotModel.find(filter)
      .select("startedAt expiresAt meta status plan")
      .limit(userId ? 200 : 500);

    const planIds = [
      ...new Set(docs.map((doc) => String(doc.plan || "")).filter(Boolean)),
    ];
    const plans = planIds.length
      ? await DB.Models.SubscriptionPlan.find({ _id: { $in: planIds } })
          .select("durationInDays")
          .lean()
      : [];
    const durationByPlan = new Map(
      plans.map((plan) => [String(plan._id), Number(plan.durationInDays || 0)])
    );

    const now = new Date();
    const slackMs = 12 * 60 * 60 * 1000;

    for (const doc of docs) {
      const bonus = Number(doc.meta?.bonusDays || 0);
      const baseFromMeta = Number(doc.meta?.baseDurationInDays || 0);
      const baseFromPlan = durationByPlan.get(String(doc.plan)) || 0;
      const base = baseFromMeta > 0 ? baseFromMeta : baseFromPlan;

      let nextExpires: Date | null = null;
      if (doc.startedAt && base > 0) {
        nextExpires = new Date(doc.startedAt);
        nextExpires.setDate(nextExpires.getDate() + base);
      } else if (doc.expiresAt && bonus > 0) {
        nextExpires = new Date(doc.expiresAt);
        nextExpires.setDate(nextExpires.getDate() - bonus);
      }
      if (!nextExpires) continue;

      const current = doc.expiresAt ? new Date(doc.expiresAt) : null;
      const inflated =
        !current || current.getTime() > nextExpires.getTime() + slackMs;
      if (bonus <= 0 && !inflated) continue;

      const nextStatus =
        doc.status === "active" && nextExpires < now ? "expired" : doc.status;

      await this.SnapshotModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            expiresAt: nextExpires,
            status: nextStatus,
            "meta.bonusDays": 0,
            ...(base > 0 ? { "meta.baseDurationInDays": base } : {}),
          },
        }
      );
    }
  }

  /**
   * Get all currently valid snapshots for a user.
   */
  static async getActiveSnapshots(
    userId: string,
    options?: { category?: "standard" | "white-labeling" }
  ): Promise<IUserSubscriptionSnapshotDoc[]> {
    const filter: FilterQuery<IUserSubscriptionSnapshotDoc> = {
      user: userId,
      status: "active",
      expiresAt: { $gte: new Date() },
    };

    if (options?.category === "white-labeling") {
      filter["meta.category"] = "white-labeling";
    } else if (options?.category === "standard") {
      filter["meta.category"] = { $nin: ["white-labeling"] };
    }

    await this.stripComplimentaryBonusValidity(userId);
    return this.SnapshotModel.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Get the current practitioner-eligible snapshot.
   * Standard and white-labeling both count. Pass `category` to scope the lookup.
   */
  static async getActiveSnapshot(
    userId: string,
    options?: { category?: "standard" | "white-labeling" }
  ): Promise<IUserSubscriptionSnapshotDoc | null> {
    const snapshots = await this.getActiveSnapshots(userId, options);
    return snapshots[0] || null;
  }

  static async getActiveSnapshotWithFeatures(
    userId: string,
    options?: { category?: "standard" | "white-labeling" }
  ): Promise<IUserSubscriptionSnapshotDoc | null> {
    const filter: FilterQuery<IUserSubscriptionSnapshotDoc> = {
      user: userId,
      status: "active",
      expiresAt: { $gte: new Date() },
    };

    if (options?.category === "white-labeling") {
      filter["meta.category"] = "white-labeling";
    } else if (options?.category === "standard") {
      filter["meta.category"] = { $nin: ["white-labeling"] };
    }

    await this.stripComplimentaryBonusValidity(userId);
    return this.SnapshotModel.findOne(filter)
      .sort({ createdAt: -1 })
      .populate("features.feature", "key label isActive")
      .populate("plan", "name code category benefits billingInterval");
  }

 
  /**
   * Expire snapshots that passed expiry date
   */
  static async expireSnapshots(): Promise<number> {
    await this.stripComplimentaryBonusValidity();
    const result = await this.SnapshotModel.updateMany(
      {
        status: "active",
        expiresAt: { $lt: new Date() },
      },
      { $set: { status: "expired" } }
    );
    return result.modifiedCount;
  }

  /**
     * Get snapshot by transaction ID
     */
    static async getSnapshotByTransactionId(
    transactionId: string | mongoose.Types.ObjectId
    ): Promise<IUserSubscriptionSnapshotDoc | null> {
    const txId = typeof transactionId === "string" ? new mongoose.Types.ObjectId(transactionId) : transactionId;

    return this.SnapshotModel.findOne({ transaction: txId })
        .populate('user').populate('plan');
    }
 

  /**
   * General-purpose query
   */
  static async querySnapshots<
    TDocument = IUserSubscriptionSnapshotDoc
    >(
    filters: FilterQuery<IUserSubscriptionSnapshotDoc> = {},
    options: {
        sort?: Record<string, 1 | -1>;
        limit?: number;
        skip?: number;
        populate?: { path: string; select?: string | string[] }[];
        lean?: boolean;
  } = {}
    ): Promise<TDocument[]> {
    let query = this.SnapshotModel.find(filters);

    if (options.sort) query = query.sort(options.sort);
    if (options.skip) query = query.skip(options.skip);
    if (options.limit) query = query.limit(options.limit);

    if (options.populate && options.populate.length > 0) {
        options.populate.forEach((p) => (query = query.populate(p)));
    }

    if (options.lean) {
        // cast to TDocument[] because lean() returns plain objects
        return query.lean<TDocument[]>().exec();
    }

    return query.exec() as unknown as TDocument[];
  }


}
