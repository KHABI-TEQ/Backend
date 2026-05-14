import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";
import { DB } from "../index";
import sendEmail from "../../common/send.email";
import { generalEmailLayout } from "../../common/emailTemplates/emailLayout";
import {
  normalizeSyndicationPropertyTypesInput,
  SYNDICATION_PROPERTY_TYPE_VALUES,
} from "../../common/syndicationPropertyTypes";
import {
  buildSyndicationIntegrationAppendixText,
  publicApiBaseUrl,
  syndicationListingInboundWebhookUrl,
  syndicationUserAuthenticationWebhookUrl,
} from "../../common/syndicationIntegrationUrls";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    const { reviewNotes, platformKey, platformName, authType, config, acceptedPropertyTypes: acceptedPropertyTypesBody } =
      req.body || {};

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
    const loginUrl = String(config?.loginUrl || application.loginUrl).trim();

    const existing = await DB.Models.SyndicationPlatform.findOne({
      platformKey: finalPlatformKey,
    }).lean();
    if (existing) {
      throw new RouteError(HttpStatusCodes.CONFLICT, "Platform key already exists");
    }

    const fromBody = normalizeSyndicationPropertyTypesInput(acceptedPropertyTypesBody);
    const fromApp = normalizeSyndicationPropertyTypesInput((application as any).acceptedPropertyTypes);
    const finalAcceptedPropertyTypes =
      fromBody.length > 0 ? fromBody : fromApp.length > 0 ? fromApp : [...SYNDICATION_PROPERTY_TYPE_VALUES];

    const createdPlatform = await DB.Models.SyndicationPlatform.create({
      platformKey: finalPlatformKey,
      platformName: finalPlatformName,
      description: `Auto-created from public application (${application.companyName})`,
      authType: finalAuthType,
      status: "approved",
      acceptedPropertyTypes: finalAcceptedPropertyTypes,
      config: {
        baseUrl,
        loginUrl,
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
      const listingWebhookUrl = syndicationListingInboundWebhookUrl(createdPlatform.platformKey);
      const authWebhookUrl = syndicationUserAuthenticationWebhookUrl();
      const webhookSecret = String(process.env.SYNDICATION_WEBHOOK_SECRET || "").trim();
      const authCallbackSecret = String(
        process.env.SYNDICATION_AUTH_CALLBACK_SECRET || process.env.SYNDICATION_WEBHOOK_SECRET || ""
      ).trim();
      const signingEnabled = Boolean(webhookSecret);
      const authSigningEnabled = Boolean(authCallbackSecret);
      const signingHtml = signingEnabled
        ? `<p><strong>Listing webhook signing (when enabled):</strong> Header <code>x-platform-signature</code> = hex(HMAC-SHA256 of the exact JSON body) using the secret below.</p>
        <p><strong>Webhook signing secret:</strong> <code style="word-break:break-all;">${escapeHtml(webhookSecret)}</code></p>
        <p style="font-size:14px;color:#555;">Store this secret only in your credential store; do not commit it to source control or share it beyond your integration team.</p>`
        : `<p><strong>Listing webhook signing:</strong> Optional in this environment; we may enable it later.</p>`;

      const authSigningHtml = authSigningEnabled
        ? `<p><strong>User authentication callback signing:</strong> Same algorithm — header <code>x-platform-signature</code> = hex(HMAC-SHA256(JSON body)). Use secret: <code style="word-break:break-all;">${escapeHtml(authCallbackSecret)}</code> (or set <code>SYNDICATION_AUTH_CALLBACK_SECRET</code> separately from listing webhooks).</p>`
        : `<p><strong>User authentication callback signing:</strong> Optional unless the hub sets <code>SYNDICATION_AUTH_CALLBACK_SECRET</code> or <code>SYNDICATION_WEBHOOK_SECRET</code>.</p>`;

      const appendix = buildSyndicationIntegrationAppendixText({
        platformKey: createdPlatform.platformKey,
        hubBase,
        listingWebhookUrl,
        authWebhookUrl,
        webhookSecretConfigured: signingEnabled || authSigningEnabled,
      });

      const body = generalEmailLayout(`
        <h3>Your Syndication Application Was Approved</h3>
        <p>Hello ${escapeHtml(application.contactName)},</p>
        <p>Your platform application for <strong>${escapeHtml(application.platformName)}</strong> has been <strong>approved</strong>.</p>
        <p><strong>Registered platform key:</strong> <code>${escapeHtml(createdPlatform.platformKey)}</code></p>
        <p><strong>KhabiTeq API base (for your integration):</strong> ${hubBase ? `<code>${escapeHtml(hubBase)}</code>` : "<em>Not configured on our server (ask your contact for the production API base URL).</em>"}</p>
        <p><strong>Listing lifecycle webhooks (optional):</strong> <code>POST</code></p>
        <p><code style="word-break:break-all;">${escapeHtml(listingWebhookUrl || "(configure API_BASE_URL or CLIENT_LINK on Khabi-Teq)")}</code></p>
        ${signingHtml}
        <h4 style="margin-top:24px;">User registration verification (partner_login)</h4>
        <p>When hub users connect with email and password, Khabi-Teq will <code>POST</code> to your <strong>login URL</strong> (<code>config.loginUrl</code> if set, otherwise <code>config.baseUrl</code>) with:</p>
        <ul style="padding-left:20px;">
          <li>Headers: <code>X-Khabiteq-Correlation-Id</code> (UUID), <code>X-Khabiteq-Platform-Key</code> (your platform key)</li>
          <li>JSON body: <code>{ "email": "...", "password": "..." }</code> only</li>
        </ul>
        <p>After you validate credentials, call our authentication callback:</p>
        <p><code style="word-break:break-all;">${escapeHtml(authWebhookUrl || "(configure API_BASE_URL or CLIENT_LINK)")}</code></p>
        <p>JSON body (camelCase): <code>success</code>, <code>verified</code>, <code>correlationId</code> (echo header), <code>email</code> (lowercase), <code>platformKey</code> (echo header), optional <code>message</code>, optional <code>externalUserId</code>.</p>
        ${authSigningHtml}
        <p><strong>Review notes:</strong> ${escapeHtml(application.reviewNotes || "Approved")}</p>
        <p>A plain-text integration appendix is attached to this email for your engineering team.</p>
      `);

      const textLines = [
        `Hello ${application.contactName},`,
        "",
        `Your platform application for ${application.platformName} has been approved.`,
        "",
        `Registered platform key: ${createdPlatform.platformKey}`,
        "",
        `Khabi-Teq API base: ${hubBase || "(not configured — ask your Khabi-Teq contact)"}`,
        `Listing webhook URL: ${listingWebhookUrl || "(not configured)"}`,
        `User authentication callback URL: ${authWebhookUrl || "(not configured)"}`,
        "",
        "See attached khabiteq-syndication-integration.txt for full technical reference.",
        "",
      ];
      if (signingEnabled) {
        textLines.push(
          "Listing webhook signing: header x-platform-signature = hex(HMAC-SHA256(JSON body string, secret below)).",
          `Secret: ${webhookSecret}`,
          ""
        );
      }
      if (authSigningEnabled) {
        textLines.push(
          "Auth callback signing: same header/algorithm; secret may be SYNDICATION_AUTH_CALLBACK_SECRET or SYNDICATION_WEBHOOK_SECRET.",
          `Auth callback secret: ${authCallbackSecret}`,
          ""
        );
      }
      textLines.push(`Review notes: ${application.reviewNotes || "Approved"}`, "", "— Khabi-Teq");
      await sendEmail({
        to: application.contactEmail,
        subject: "Syndication platform application approved",
        text: textLines.join("\n"),
        html: body,
        attachments: [
          {
            filename: "khabiteq-syndication-integration.txt",
            content: appendix,
            contentType: "text/plain; charset=utf-8",
          },
        ],
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

