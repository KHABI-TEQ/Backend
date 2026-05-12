import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Public API origin used in partner-facing emails (same envs as outbound syndication links). */
function publicApiBaseUrl(): string {
  return String(process.env.API_BASE_URL || process.env.CLIENT_LINK || "").trim().replace(/\/+$/, "");
}

/** Full URL partners should POST inbound webhooks to (Khabiteq receives). */
function syndicationInboundWebhookUrl(platformKey: string): string {
  const base = publicApiBaseUrl();
  if (!base) return "";
  const pk = encodeURIComponent(String(platformKey).trim().toLowerCase());
  const path = `/third-party/syndication/webhooks/${pk}`;
  if (/\/api$/i.test(base)) return `${base}${path}`;
  return `${base}/api${path}`;
}

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
      const hubBase = publicApiBaseUrl();
      const webhookUrl = syndicationInboundWebhookUrl(createdPlatform.platformKey);
      const webhookSecret = String(process.env.SYNDICATION_WEBHOOK_SECRET || "").trim();
      const signingEnabled = Boolean(webhookSecret);
      const signingHtml = signingEnabled
        ? `<p><strong>Webhook signing (required):</strong> Include header <code>x-platform-signature</code> on each POST: hex-encoded HMAC-SHA256 of the <strong>exact JSON body string</strong> you send, using the secret below (same string your server puts on the wire after serialization).</p>
        <p><strong>Webhook signing secret:</strong> <code style="word-break:break-all;">${escapeHtml(webhookSecret)}</code></p>
        <p style="font-size:14px;color:#555;">Store this secret only in your credential store; do not commit it to source control or share it beyond your integration team.</p>`
        : `<p><strong>Webhook signing:</strong> The current Khabi-Teq environment does not require a signature on inbound webhooks. If we enable signing later, we will notify you with the secret and algorithm separately.</p>`;

      const body = generalEmailLayout(`
        <h3>Your Syndication Application Was Approved</h3>
        <p>Hello ${escapeHtml(application.contactName)},</p>
        <p>Your platform application for <strong>${escapeHtml(application.platformName)}</strong> has been <strong>approved</strong>.</p>
        <p><strong>Registered platform key:</strong> <code>${escapeHtml(createdPlatform.platformKey)}</code></p>
        <p><strong>KhabiTeq API base (for your integration):</strong> ${hubBase ? `<code>${escapeHtml(hubBase)}</code>` : "<em>Not configured on our server (ask your contact for the production API base URL).</em>"}</p>
        <p><strong>Inbound webhooks (your servers → Khabi-Teq):</strong> Send JSON <code>POST</code> requests to:</p>
        <p><code style="word-break:break-all;">${escapeHtml(webhookUrl || "(configure API_BASE_URL or CLIENT_LINK on Khabi-Teq)")}</code></p>
        ${signingHtml}
        <p><strong>Review notes:</strong> ${escapeHtml(application.reviewNotes || "Approved")}</p>
        <p>Next steps: ensure your technical team can reach the URL above from your network, implement signing as described, and follow any integration checklist we have shared separately.</p>
      `);

      const textLines = [
        `Hello ${application.contactName},`,
        "",
        `Your platform application for ${application.platformName} has been approved.`,
        "",
        `Registered platform key: ${createdPlatform.platformKey}`,
        "",
        `Khabi-Teq API base: ${hubBase || "(not configured — ask your Khabi-Teq contact)"}`,
        `Inbound webhook URL (POST JSON here): ${webhookUrl || "(not configured — ask your Khabi-Teq contact)"}`,
        "",
      ];
      if (signingEnabled) {
        textLines.push(
          "Webhook signing: required. Header x-platform-signature = hex(HMAC-SHA256(JSON body string, secret below)).",
          `Webhook signing secret: ${webhookSecret}`,
          "Store the secret securely; do not commit it to git.",
          ""
        );
      } else {
        textLines.push("Webhook signing is not required in the current Khabi-Teq environment.", "");
      }
      textLines.push(`Review notes: ${application.reviewNotes || "Approved"}`, "", "— Khabi-Teq");
      await sendEmail({
        to: application.contactEmail,
        subject: "Syndication platform application approved",
        text: textLines.join("\n"),
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

