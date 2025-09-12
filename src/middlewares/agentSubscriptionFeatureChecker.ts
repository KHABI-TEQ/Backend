import { Response, NextFunction } from "express";
import { AppRequest } from "../types/express";
import { UserSubscriptionSnapshotService } from "../services/userSubscriptionSnapshot.service";

/**
 * Middleware to optionally validate subscription & feature access for Agents only
 * @param options
 *  - requireActiveSubscription: boolean → check if user has active subscription
 *  - requiredFeatureKey: string → check if user has access to this feature
 */
export const agentSubscriptionFeatureChecker = (options?: {
  requireActiveSubscription?: boolean;
  requiredFeatureKey?: string;
}) => {
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Unauthorized. User not found." });

      // Only Agents require subscription/feature check
      if (user.userType !== "Agent") return next();

      let snapshot: any = null;

      if (options?.requireActiveSubscription || options?.requiredFeatureKey) {
        snapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(user._id);

        if (options?.requireActiveSubscription && !snapshot) {
          return res.status(403).json({ 
            message: "Access denied. You need an active subscription to perform this action." 
          });
        }
      }

      if (options?.requiredFeatureKey) {
        const featureKey = options.requiredFeatureKey.toUpperCase();

        const feature = snapshot?.features?.find(
          (f: any) => f.featureKey?.toUpperCase() === featureKey
        );

        if (!feature) {
          return res.status(403).json({ 
            message: `Access denied. You do not have the required feature: ${featureKey}` 
          });
        }

        // Check usage for count/boolean type
        if (feature.type === "count" && (feature.remaining ?? 0) <= 0) {
          return res.status(403).json({ 
            message: `Access denied. Feature quota exceeded for: ${featureKey}` 
          });
        }

        if (feature.type === "boolean" && feature.value !== 1) {
          return res.status(403).json({ 
            message: `Access denied. Feature is not enabled: ${featureKey}` 
          });
        }

        // unlimited → always accessible
      }

      if (snapshot) req.subscriptionSnapshot = snapshot;

      next();
    } catch (err) {
      console.error("[FEATURE CHECK] Error:", err);
      return res.status(500).json({ message: "Internal server error while checking subscription features." });
    }
  };
};
