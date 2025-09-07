import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";

export const getPublicAgentProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { publicAccessUID } = req.params;

    if (!publicAccessUID) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Public access UID is required.",
      });
    }

    // 1️⃣ Find the User who is an Agent and has public access enabled
    const user = await DB.Models.User.findOne({
      userType: "Agent",
      "publicAccess.url": publicAccessUID, // <-- You’re storing url, not uid
      "publicAccess.urlEnabled": true,
    }).lean();

    if (!user) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "This agent profile is not available. They may not have public access enabled.",
      });
    }

    // 2️⃣ Find the Agent details
    const agent = await DB.Models.Agent.findOne({ userId: user._id })
      .populate("featuredListings") // pull property details
      .lean();

    if (!agent) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: "Agent profile details not found.",
      });
    }

    // 3️⃣ Get some stats (example: number of properties created by this agent)
    const totalProperties = await DB.Models.Property.countDocuments({
        owner: user._id,
    });

    // Define meaningful groupings
    const activeStatuses = [
        "active",
        "approved",
        "contingent",
        "under_contract",
        "coming_soon",
        "back_on_market",
    ];

    const inactiveStatuses = [
        "inactive",
        "expired",
        "withdrawn",
        "cancelled",
        "temporarily_off_market",
        "hold",
        "never_listed",
    ];

    const closedStatuses = ["sold", "failed", "rejected", "deleted", "flagged"];

    // Count grouped stats
    const activeProperties = await DB.Models.Property.countDocuments({
        owner: user._id,
        status: { $in: activeStatuses },
    });

    const inactiveProperties = await DB.Models.Property.countDocuments({
        owner: user._id,
        status: { $in: inactiveStatuses },
    });

    const closedProperties = await DB.Models.Property.countDocuments({
        owner: user._id,
        status: { $in: closedStatuses },
    });


    // 4️⃣ You could also fetch subscription if relevant
    const activeSubscription = await DB.Models.Subscription.findOne({
      user: user._id,
      status: "active",
      endDate: { $gte: new Date() },
    }).lean();

    // 5️⃣ Build response
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Public agent profile fetched successfully",
      data: {
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profile_picture: user.profile_picture,
          publicUrl: user.publicAccess?.url,
        },
        agent: {
          address: agent.address,
          regionOfOperation: agent.regionOfOperation,
          agentType: agent.agentType,
          companyAgent: agent.companyAgent,
        },
        stats: {
          totalProperties,
          activeProperties,
          inactiveProperties,
          closedProperties
        },
        activeSubscription: activeSubscription || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
