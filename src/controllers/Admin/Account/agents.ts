import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import sendEmail from "../../../common/send.email";

import { generalEmailLayout } from "../../../common/emailTemplates/emailLayout";
import { DeactivateOrActivateAgent, accountDisaapproved, accountApproved, DeleteAgent, accountUpgradeApprovedTemplate, accountUpgradeDisapprovedTemplate } from "../../../common/emailTemplates/agentMails";


/**
 * Toggles the 'isInActive' and 'accountApproved' status of an agent and their properties.
 * Also sends an email notification to the agent.
 *
 * @param req - The Express request object, containing userId in params and isInactive/reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const toggleAgentStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { isInactive, reason } = req.body;

    if (typeof isInactive !== "boolean") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "isInactive status (boolean) is required.",
      });
    }

    // Validate user existence and type
    const user = await DB.Models.User.findById(userId).exec();
    if (!user || user.userType !== "Agent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "User not found or not an agent"));
    }

    // Update user status
    user.isInActive = isInactive;
    user.accountApproved = !isInactive;
    await user.save();

    // Fetch and update agent record linked to this user
    const agent = await DB.Models.Agent.findOneAndUpdate(
      { userId },
      {
        isInActive: isInactive,
        accountApproved: !isInactive,
      },
      { new: true }
    ).exec();

    if (!agent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent record not found"));
    }

    // Update properties linked to this agent
    await DB.Models.Property.updateMany(
      { owner: user._id },
      { isApproved: !isInactive }
    ).exec();

    // Send email notification
    const mailBody = generalEmailLayout(
      DeactivateOrActivateAgent(
        user.fullName || `${user.firstName || ""} ${user.lastName || ""}` || user.email,
        isInactive,
        reason || ""
      )
    );

    await sendEmail({
      to: user.email,
      subject: isInactive ? "Account Deactivated" : "Account Activated",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: isInactive ? "Agent deactivated successfully" : "Agent activated successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Deletes an agent's account and associated agent and user records.
 * Sends an email notification to the deleted agent.
 *
 * @param req - The Express request object, containing userId in params and reason in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const deleteAgentAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // Reason for deletion

    const user = await DB.Models.User.findById(userId).exec();

    if (!user || user.userType !== "Agent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent user not found or not an agent"));
    }

    await DB.Models.User.findByIdAndUpdate(user._id, { isDeleted: true }).exec();
    await DB.Models.Agent.findOneAndUpdate({ userId: user._id }, { isDeleted: true }).exec();

    // Send email
    const mailBody = generalEmailLayout(
      DeleteAgent(
        user.firstName || user.lastName || user.email,
        reason
      )
    );

    await sendEmail({
      to: user.email,
      subject: "Account Deleted",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent user and associated records deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Retrieves all agent upgrade requests with pagination and sorting.
 *
 * @param req - The Express request object, containing page and limit in query.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAllAgentUpgradeRequests = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const query = {
      isDeleted: false,
    };

    const agents = await DB.Models.Agent.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "email firstName lastName phoneNumber fullName isAccountVerified accountStatus isFlagged") // Select useful user fields
      .exec();

    const total = await DB.Models.Agent.countDocuments(query);

    const formattedData = agents.map((agent) => {
      const user = agent.userId as any;

      return {
        id: agent._id,
        userId: user?._id || null,
        name: user ? `${user.firstName} ${user.lastName}` : null,
        email: user?.email || null,
        phoneNumber: user?.phoneNumber || null,
        requestDate: {},
        upgradeStatus: agent.accountApproved ? "Approved" : "Pending",
        accountStatus: user?.accountStatus || "unknown",
        accountVerified: user?.isAccountVerified || false,
        flagged: user?.isFlagged || false,
        agentType: agent.agentType,
        companyAgent: {},
      };
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent upgrade requests fetched successfully",
      data: formattedData,
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approves or disapproves an agent's onboarding status.
 * Sends an email notification to the agent.
 *
 * @param req - The Express request object, containing _id in params and approved in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const approveAgentOnboardingStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, approved } = req.body; // boolean

    if (typeof approved !== 'boolean') {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Approval status (boolean) is required.",
      });
    }

    const userAcct = await DB.Models.User.findByIdAndUpdate(
      userId,
      { accountApproved: approved },
      { new: true }
    ).exec();

    if (!userAcct) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent (User) not found"));
    }

    // Update the Agent-specific record as well
    await DB.Models.Agent.findOneAndUpdate(
      { userId: userAcct._id },
      { accountApproved: approved },
      { new: true }
    ).exec();

    const subject = approved
      ? "Welcome to KhabiTeqRealty – Your Partnership Opportunity Awaits!"
      : "Update on Your KhabiTeqRealty Application";

    const emailBody = generalEmailLayout(
      approved ? accountApproved(userAcct.firstName) : accountDisaapproved(userAcct.firstName)
    );

    await sendEmail({
      to: userAcct.email,
      subject,
      text: emailBody,
      html: emailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: approved
        ? "Agent onboarding approved successfully"
        : "Agent onboarding rejected successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Flags or unflags an agent's account.
 *
 * @param req - The Express request object, containing userId in params and status in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const flagOrUnflagAgentAccount = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params; // ID from the users table
    const { status } = req.body; // boolean

    if (typeof status !== "boolean") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Flag status (boolean) is required.",
      });
    }

    // Find user to validate existence and type
    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "Agent") {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Agent user not found or not an agent"
        )
      );
    }

    // Find and update the agent using userId
    const agent = await DB.Models.Agent.findOneAndUpdate(
      { userId },
      { isFlagged: status },
      { new: true }
    ).exec();

    if (!agent) {
      return next(
        new RouteError(HttpStatusCodes.NOT_FOUND, "Agent record not found")
      );
    }

    // Also update the User's flagged status
    await DB.Models.User.findByIdAndUpdate(userId, { isFlagged: status });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: status
        ? "Agent flagged successfully"
        : "Agent unflagged successfully",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Retrieves the complete profile of a single agent, including related properties, transactions, and inspections.
 *
 * @param req - The Express request object, containing userId in params.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getSingleAgentProfile = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "Agent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent user not found or not an agent"));
    }

    const agentData = await DB.Models.Agent.findOne({ userId }).lean();
    const properties = await DB.Models.Property.find({ owner: user._id }).lean();
    const transactions = await DB.Models.Transaction.find({ buyerId: user._id }).lean();
    const inspections = await DB.Models.InspectionBooking.find({ bookedBy: user._id }).lean();

    const completedInspections = inspections.filter((i: any) => i.status === "completed");

    const profileData = {
      user,
      agentData,
      properties,
      transactions,
      inspections,
      stats: {
        totalProperties: properties.length,
        totalTransactions: transactions.length,
        totalSpent: 0, // Assuming this needs to be calculated from transactions if available
        completedInspections: completedInspections.length,
        ongoingNegotiations: inspections.filter((i: any) => i.stage === "negotiation").length,
      },
    };

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent profile fetched successfully",
      data: profileData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves only agent dashboard statistics.
 *
 * @param req - The Express request object, expecting userType query param.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAgentDashboardStatistics = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userType = req.query.userType as string;

    if (!userType || userType !== 'Agent') {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "userType must be 'Agent'.",
      });
    }

    // Compute statistics
    const [totalActiveAgents, totalInactiveAgents, totalFlaggedAgents, totalAgents] = await Promise.all([
      DB.Models.User.countDocuments({
        isInActive: false,
        accountApproved: true,
        userType,
        isDeleted: false,
      }),
      DB.Models.User.countDocuments({
        isInActive: true,
        accountApproved: true,
        userType,
        isDeleted: false,
      }),
      DB.Models.User.countDocuments({
        isFlagged: true,
        accountApproved: true,
        userType,
        isDeleted: false,
      }),
      DB.Models.User.countDocuments({ userType, isDeleted: false }),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent dashboard statistics fetched successfully",
      data: {
        totalActiveAgents,
        totalInactiveAgents,
        totalFlaggedAgents,
        totalAgents,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Approves or disapproves an agent's upgrade request.
 * Sends an email notification to the agent.
 *
 * @param req - The Express request object, containing _id (user ID) in params and approved in body.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const approveAgentUpgradeRequestStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { _id } = req.params; // User ID
    const { approved } = req.body; // boolean

    if (typeof approved !== 'boolean') {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Approval status (boolean) is required.",
      });
    }

    const user = await DB.Models.User.findById(_id).exec();
    if (!user) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "User (Agent) not found"));
    }

    const agent = await DB.Models.Agent.findOne({ userId: user._id }).exec();
    if (!agent) {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent record not found for this user"));
    }

 
    const mailBody = generalEmailLayout(
      approved
        ? accountUpgradeApprovedTemplate(user.firstName)
        : accountUpgradeDisapprovedTemplate(user.firstName)
    );

    await sendEmail({
      to: user.email,
      subject: "Update on Your KhabiTeqRealty Application",
      text: mailBody,
      html: mailBody,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: approved ? "Agent upgrade approved" : "Agent upgrade disapproved",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves all agents with filters, search, and pagination.
 *
 * @param req - The Express request object, containing query parameters for filtering, searching, and pagination.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */ 
export const getAllAgents = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const safePage = Math.max(1, Number(req.query.page) || 1);
    const safeLimit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (safePage - 1) * safeLimit;

    const {
      search,
      isAccountVerified,
      isInActive,
      isFlagged,
      accountApproved,
      accountStatus,
      excludeInactive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const match: any = { userType: "Agent", isDeleted: false };
    const searchConditions: any[] = [];

    if (search && search.toString().trim()) {
      const regex = new RegExp(search.toString().trim(), "i");
      searchConditions.push(
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
        { fullName: regex }
      );
    }

    if (searchConditions.length > 0) {
      match.$or = searchConditions;
    }

    if (isAccountVerified !== undefined)
      match.isAccountVerified = isAccountVerified === "true";

    if (isInActive !== undefined)
      match.isInActive = isInActive === "true";

    if (isFlagged !== undefined)
      match.isFlagged = isFlagged === "true";

    if (accountApproved !== undefined)
      match.accountApproved = accountApproved === "true";

    if (accountStatus && accountStatus !== "null")
      match.accountStatus = accountStatus;

    if (excludeInactive !== false && excludeInactive !== "false")
      match.isInActive = false;

    // Sorting
    const sort: any = {};
    sort[sortBy.toString()] = sortOrder === "asc" ? 1 : -1;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "agents",
          localField: "_id",
          foreignField: "userId",
          as: "agentProfile",
        },
      },
      { $unwind: { path: "$agentProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          password: 0,
          googleId: 0,
          facebookId: 0,
          __v: 0,
          "agentProfile.__v": 0,
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: safeLimit },
    ];

    const agents = await DB.Models.User.aggregate(pipeline);
    const total = await DB.Models.User.countDocuments(match);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agents fetched successfully",
      data: agents,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Retrieves all properties owned by a specific agents.
 *
 * @param req - The Express request object, containing userId in params.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const getAllAgentProperties = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== "Agent") {
      return next(new RouteError(HttpStatusCodes.NOT_FOUND, "Agent not found"));
    }

    const properties = await DB.Models.Property.find({
      owner: user._id,
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.Property.countDocuments({ owner: user._id });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Agent properties fetched successfully",
      data: properties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};