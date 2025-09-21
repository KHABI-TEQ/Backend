import { Response, NextFunction } from "express";
import { AppRequest } from "../types/express";
import { UserSubscriptionSnapshotService } from "../services/userSubscriptionSnapshot.service";

/**
 * Middleware to optionally validate subscription & feature access
 * @param options
 *  - requireActiveSubscription: boolean → check if user has active subscription
 *  - requiredFeatureKey: string → check if user has access to this feature
 *  - allowedUserTypes: string[] → restrict which userTypes can access (default: ["Agent"])
 */
export const agentSubscriptionFeatureChecker = (options?: {
  requireActiveSubscription?: boolean;
  requiredFeatureKey?: string;
  allowedUserTypes?: string[]; // <-- new param
}) => {
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized. User not found." });
      }

      const allowedUserTypes = options?.allowedUserTypes ?? ["Agent"];

      // Check if user type is allowed
      if (!allowedUserTypes.includes(user.userType)) {
        return res.status(403).json({
          message: `Access denied. User type '${user.userType}' is not permitted for this action.`,
        });
      }

      let snapshot: any = null;

      // Only run subscription/feature check for agents
      if (
        user.userType === "Agent" &&
        (options?.requireActiveSubscription || options?.requiredFeatureKey)
      ) {
        snapshot = await UserSubscriptionSnapshotService.getActiveSnapshot(user._id);

        if (options?.requireActiveSubscription && !snapshot) {
          return res.status(403).json({
            message:
              "Access denied. You need an active subscription to perform this action.",
          });
        }

        if (options?.requiredFeatureKey) {
          const featureKey = options.requiredFeatureKey.toUpperCase();

          const feature = snapshot?.features?.find(
            (f: any) => f.featureKey?.toUpperCase() === featureKey
          );

          if (!feature) {
            return res.status(403).json({
              message: `Access denied. You do not have the required feature: ${featureKey}`,
            });
          }

          // Check usage for count/boolean type
          if (feature.type === "count" && (feature.remaining ?? 0) <= 0) {
            return res.status(403).json({
              message: `Access denied. Feature quota exceeded for: ${featureKey}`,
            });
          }

          if (feature.type === "boolean" && feature.value !== 1) {
            return res.status(403).json({
              message: `Access denied. Feature is not enabled: ${featureKey}`,
            });
          }

          // unlimited → always accessible
        }
      }

      if (snapshot) req.subscriptionSnapshot = snapshot;

      next();
    } catch (err) {
      console.error("[FEATURE CHECK] Error:", err);
      return res
        .status(500)
        .json({ message: "Internal server error while checking subscription features." });
    }
  };
};
