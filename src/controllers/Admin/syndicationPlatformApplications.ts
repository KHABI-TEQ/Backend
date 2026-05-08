import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";

export const listSyndicationPlatformApplications = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    const query: any = {};
    if (
      status &&
      ["pending", "under_review", "approved", "rejected"].includes(String(status))
    ) {
      query.status = String(status);
    }

    const data = await DB.Models.SyndicationPlatformApplication.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Syndication platform applications fetched successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const reviewSyndicationPlatformApplication = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid application id");
    }
    if (!["under_review", "rejected"].includes(String(status))) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "status must be under_review or rejected"
      );
    }

    const updated = await DB.Models.SyndicationPlatformApplication.findByIdAndUpdate(
      id,
      {
        $set: {
          status: String(status),
          reviewNotes: reviewNotes ? String(reviewNotes) : undefined,
          reviewedByAdminId: req.admin?._id ? String(req.admin._id) : undefined,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Application not found");
    }

    try {
      const body = generalEmailLayout(`
        <h3>Your Syndication Application Status Was Updated</h3>
        <p>Hello ${updated.contactName},</p>
        <p>Your platform application for <strong>${updated.platformName}</strong> is now <strong>${updated.status}</strong>.</p>
        <p><strong>Review Notes:</strong> ${updated.reviewNotes || "No additional notes."}</p>
      `);
      await sendEmail({
        to: updated.contactEmail,
        subject: `Syndication application is now ${updated.status}`,
        text: `Your platform application for ${updated.platformName} is now ${updated.status}.`,
        html: body,
      });
    } catch (mailErr) {
      console.warn("[reviewSyndicationPlatformApplication] applicant email failed:", mailErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Application marked as ${status}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const approveSyndicationPlatformApplication = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reviewNotes, platformKey, platformName, authType, config } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid application id");
    }

    const application = await DB.Models.SyndicationPlatformApplication.findById(id);
    if (!application) throw new RouteError(HttpStatusCodes.NOT_FOUND, "Application not found");
    if (application.status === "approved" && application.approvedPlatformId) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Application already approved");
    }

    const finalPlatformKey = String(
      platformKey || application.platformKeySuggestion
    ).trim().toLowerCase();
    const finalPlatformName = String(platformName || application.platformName).trim();
    const finalAuthType = String(authType || application.authType).trim();
    const baseUrl = String(config?.baseUrl || application.baseUrl).trim();

    const existing = await DB.Models.SyndicationPlatform.findOne({
      platformKey: finalPlatformKey,
    }).lean();
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Platform key already exists");
    }

    const createdPlatform = await DB.Models.SyndicationPlatform.create({
      platformKey: finalPlatformKey,
      platformName: finalPlatformName,
      description: `Auto-created from public application (${application.companyName})`,
      authType: finalAuthType,
      status: "approved",
      config: {
        baseUrl,
        outboundEnabled: config?.outboundEnabled !== false,
        inboundWebhookEnabled: config?.inboundWebhookEnabled !== false,
      },
    });

    application.status = "approved";
    application.reviewNotes = reviewNotes ? String(reviewNotes) : application.reviewNotes;
    application.reviewedByAdminId = req.admin?._id ? String(req.admin._id) : undefined;
    application.reviewedAt = new Date();
    application.approvedPlatformId = String(createdPlatform._id);
    await application.save();

    try {
      const body = generalEmailLayout(`
        <h3>Your Syndication Application Was Approved</h3>
        <p>Hello ${application.contactName},</p>
        <p>Your platform application for <strong>${application.platformName}</strong> has been <strong>approved</strong>.</p>
        <p><strong>Registered Platform Key:</strong> ${createdPlatform.platformKey}</p>
        <p><strong>Base URL:</strong> ${createdPlatform.config.baseUrl}</p>
        <p><strong>Review Notes:</strong> ${application.reviewNotes || "Approved"}</p>
      `);
      await sendEmail({
        to: application.contactEmail,
        subject: "Syndication platform application approved",
        text: `Your platform application for ${application.platformName} has been approved.`,
        html: body,
      });
    } catch (mailErr) {
      console.warn("[approveSyndicationPlatformApplication] applicant email failed:", mailErr);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Application approved and platform created successfully",
      data: {
        application,
        platform: createdPlatform,
      },
    });
  } catch (err) {
    next(err);
  }
};

