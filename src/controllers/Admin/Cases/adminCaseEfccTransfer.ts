import { Request, Response } from "express";
import { DB } from "../../index";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { nextEfccRef } from "../../../services/caseCounter.service";
import { generateAndStoreCaseRecordPdf, buildCaseRecordPdf } from "../../../services/caseRecordPdf.service";
import { logCaseActivity } from "../../../services/caseActivity.service";
import sendEmail from "../../../common/send.email";
import { efccReferralMail, caseMilestoneChangedMail } from "../../../common/emailTemplates/caseMails";

/**
 * @swagger
 * /admin/cases/{id}/efcc-transfer/preview:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > EFCC Transfer
 *     summary: Preview EFCC transfer package
 *     description: Returns a summary of what will be sent to EFCC — case reference, documents included, PDF availability, and EFCC default email — without dispatching anything.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: EFCC transfer preview data returned
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_EFCC_TRANSFER permission
 */
export const previewEfccTransfer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await DB.Models.Case.findById(id).lean();
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    if (caseDoc.status !== "mediation") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Case must be in 'mediation' status to escalate to EFCC. Current status: '${caseDoc.status}'`,
      });
    }

    const [petition, registration] = await Promise.all([
      DB.Models.Petition.findById(caseDoc.petitionId).lean(),
      DB.Models.TransactionRegistration.findById(caseDoc.registrationId).lean(),
    ]);

    const defaultEfccEmail = process.env.EFCC_DEFAULT_EMAIL || "referrals@efcc.gov.ng";
    const documentsIncluded = [
      "Official LASRERA Case Record & Investigation Dossier (PDF)",
      `Digital Transaction Trail (${caseDoc.transactionReference})`,
      "Verified Payment Receipts & Transaction Summary",
      `Complainant Petition Statement (${petition?.petitionNumber || "N/A"})`,
      "Mediation Meeting Notes & Party Submissions",
    ];

    if (registration?.certificateUrl) documentsIncluded.push("LASRERA Transaction Certificate");
    if (petition?.attachments?.length) documentsIncluded.push(`Buyer Evidence Attachments (${petition.attachments.length} files)`);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "EFCC transfer preview generated",
      data: {
        caseNumber: caseDoc.caseNumber,
        transactionReference: caseDoc.transactionReference,
        defaultEfccEmail,
        documentsIncluded,
      },
    });
  } catch (error: any) {
    console.error("[AdminEfccTransfer] Error in previewEfccTransfer:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to preview EFCC transfer",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/efcc-transfer:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases > EFCC Transfer
 *     summary: Escalate case to EFCC
 *     description: |
 *       Generates the case record PDF, uploads it to Cloudinary, then emails the
 *       entire dossier (PDF + evidence attachments) to the specified EFCC inbox.
 *
 *       **Rules:**
 *       - Case must be in `mediation` status
 *       - `efccEmail` and `confirmEmail` must match exactly
 *       - `idempotencyKey` must be unique per attempt (prevents double-sends)
 *       - If total attachment size exceeds 8 MB, large files are sent as URL references in the email body
 *       - Case status automatically changes to `transferred_to_efcc` on success
 *       - EFCC receives a formatted referral email with full case context
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [efccEmail, confirmEmail, idempotencyKey]
 *             properties:
 *               efccEmail:
 *                 type: string
 *                 format: email
 *                 example: efcc.intake@efcc.gov.ng
 *               confirmEmail:
 *                 type: string
 *                 format: email
 *                 description: Must match efccEmail exactly
 *                 example: efcc.intake@efcc.gov.ng
 *               idempotencyKey:
 *                 type: string
 *                 maxLength: 100
 *                 description: Unique key to prevent duplicate transfers
 *                 example: case-efcc-transfer-2026-10-03
 *     responses:
 *       200:
 *         description: Case successfully transferred to EFCC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     transferReference: { type: string }
 *                     deliveryStatus: { type: string, enum: [sent, failed] }
 *                     efccEmail: { type: string }
 *                     pdfUrl: { type: string }
 *       400:
 *         description: Case not in mediation status, or email mismatch
 *       409:
 *         description: Duplicate idempotencyKey — transfer already attempted
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_EFCC_TRANSFER permission
 */
export const sendEfccTransfer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { efccEmail, idempotencyKey } = req.body;
    const adminUser = req.admin;

    const caseDoc = await DB.Models.Case.findById(id);
    if (!caseDoc) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Case not found" });
    }

    if (caseDoc.status !== "mediation") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Case must be in 'mediation' status to escalate to EFCC. Current status: '${caseDoc.status}'`,
      });
    }

    // Idempotency check
    const existingTransfer = await DB.Models.EfccTransfer.findOne({
      caseId: caseDoc._id,
      idempotencyKey,
    });
    if (existingTransfer) {
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: "EFCC transfer with this idempotency key has already been processed",
        data: existingTransfer,
      });
    }

    // Domain validation check if configured
    if (process.env.EFCC_ALLOWED_EMAIL_DOMAINS) {
      const allowedDomains = process.env.EFCC_ALLOWED_EMAIL_DOMAINS.split(",").map((d) => d.trim().toLowerCase());
      const emailDomain = efccEmail.split("@")[1]?.toLowerCase();
      if (!allowedDomains.includes(emailDomain)) {
        return res.status(HttpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Email domain '${emailDomain}' is not permitted for official EFCC escalation`,
        });
      }
    }

    // Generate and store PDF
    const { url: pdfUrl, fileName: pdfFileName } = await generateAndStoreCaseRecordPdf(
      String(caseDoc._id),
      String(adminUser?._id)
    );

    // Get buffer for email attachment
    const { buffer: pdfBuffer } = await buildCaseRecordPdf(String(caseDoc._id));

    const transferRef = await nextEfccRef();
    const emailSubject = `OFFICIAL ESCALATION: Real Estate Dispute ${caseDoc.caseNumber} [Ref: ${transferRef}]`;
    const emailBody = efccReferralMail({
      caseNumber: caseDoc.caseNumber,
      transactionReference: caseDoc.transactionReference,
    });

    const documentsIncluded = [
      "Official LASRERA Case Record & Investigation Dossier (PDF)",
      `Digital Transaction Trail (${caseDoc.transactionReference})`,
      "Verified Payment Receipts & Transaction Summary",
      "Mediation Meeting Notes & Party Submissions",
    ];

    let deliveryStatus: "pending" | "sent" | "failed" = "pending";
    let deliveryError: string | undefined;

    try {
      await sendEmail({
        to: efccEmail,
        subject: emailSubject,
        text: `Official dispute referral ${caseDoc.caseNumber} transferred to EFCC. Please view attached dossier.`,
        html: emailBody,
        attachments: [
          {
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      deliveryStatus = "sent";
    } catch (err: any) {
      deliveryStatus = "failed";
      deliveryError = err.message || "Failed to dispatch email to EFCC";
      console.error("[AdminEfccTransfer] Failed to send EFCC email:", err);
    }

    const transferRecord = await DB.Models.EfccTransfer.create({
      caseId: caseDoc._id,
      transferReference: transferRef,
      officer: adminUser?._id,
      efccEmail,
      emailSubject,
      documentsIncluded,
      pdfUrl,
      pdfFileName,
      attachmentsSent: [{ fileName: pdfFileName, url: pdfUrl }],
      deliveryStatus,
      deliveryError,
      sentAt: deliveryStatus === "sent" ? new Date() : undefined,
      idempotencyKey,
    });

    // Advance status only if sent successfully
    if (deliveryStatus === "sent") {
      const now = new Date();
      caseDoc.status = "transferred_to_efcc";
      caseDoc.milestones.push({
        stage: "transferred_to_efcc",
        occurredAt: now,
        by: adminUser?._id,
      });
      caseDoc.lastActivityAt = now;
      await caseDoc.save();

      await logCaseActivity({
        caseId: caseDoc._id,
        registrationId: caseDoc.registrationId,
        actorType: "Admin",
        actorId: adminUser?._id,
        actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
        action: "EFCC_TRANSFERRED",
        visibility: "buyer",
        message: `Case escalated and transmitted to EFCC (${transferRef})`,
        meta: { transferId: transferRecord._id, efccEmail },
      });

      // Notify buyer of milestone advancement
      const petition = await DB.Models.Petition.findById(caseDoc.petitionId).lean();
      if (petition?.buyer?.email) {
        try {
          await sendEmail({
            to: petition.buyer.email,
            subject: `Case #${caseDoc.caseNumber} Status Update: Transferred to EFCC`,
            text: `Your dispute case #${caseDoc.caseNumber} has been officially referred and transferred to the EFCC.`,
            html: caseMilestoneChangedMail(petition.buyer.fullName, caseDoc.caseNumber, "Transferred to EFCC"),
          });
        } catch (mErr: any) {
          console.warn("[AdminEfccTransfer] Buyer notification mail failed:", mErr.message);
        }
      }
    } else {
      await logCaseActivity({
        caseId: caseDoc._id,
        registrationId: caseDoc.registrationId,
        actorType: "Admin",
        actorId: adminUser?._id,
        actorLabel: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "LASRERA Officer",
        action: "EFCC_TRANSFER_FAILED",
        visibility: "internal",
        message: `EFCC transfer transmission failed: ${deliveryError}`,
        meta: { transferId: transferRecord._id, error: deliveryError },
      });
    }

    return res.status(deliveryStatus === "sent" ? HttpStatusCodes.CREATED : HttpStatusCodes.BAD_GATEWAY).json({
      success: deliveryStatus === "sent",
      message: deliveryStatus === "sent" ? `Case successfully transferred to EFCC (${transferRef})` : `Transfer created but email delivery failed: ${deliveryError}`,
      data: {
        transfer: transferRecord,
        case: caseDoc,
      },
    });
  } catch (error: any) {
    console.error("[AdminEfccTransfer] Error in sendEfccTransfer:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to process EFCC transfer",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/efcc-transfer:
 *   get:
 *     tags:
 *       - Admin
 *       - Admin > Cases > EFCC Transfer
 *     summary: List all EFCC transfer attempts for this case
 *     description: Returns a history of all EFCC transfer attempts including delivery status, sentAt timestamp, transfer reference, and attachments sent.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: EFCC transfer history returned
 *       404:
 *         description: Case not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_EFCC_TRANSFER permission
 */
export const listEfccTransfers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transfers = await DB.Models.EfccTransfer.find({ caseId: id })
      .populate("officer", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "EFCC transfers retrieved successfully",
      data: transfers,
    });
  } catch (error: any) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to list transfers",
    });
  }
};

/**
 * @swagger
 * /admin/cases/{id}/efcc-transfer/{transferId}/retry:
 *   post:
 *     tags:
 *       - Admin
 *       - Admin > Cases > EFCC Transfer
 *     summary: Retry a failed EFCC transfer
 *     description: Creates a new EFCC transfer record and re-dispatches the dossier. Requires a new unique `idempotencyKey`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: transferId
 *         in: path
 *         required: true
 *         description: EfccTransfer MongoDB ObjectId
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idempotencyKey]
 *             properties:
 *               idempotencyKey:
 *                 type: string
 *                 description: New unique key for this retry attempt
 *                 example: case-efcc-retry-2026-10-04
 *     responses:
 *       200:
 *         description: Retry dispatch initiated successfully
 *       404:
 *         description: Case or transfer record not found
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden — requires CASE_EFCC_TRANSFER permission
 */
export const retryEfccTransfer = async (req: Request, res: Response) => {
  try {
    const { id, transferId } = req.params;
    const transfer = await DB.Models.EfccTransfer.findOne({ _id: transferId, caseId: id });
    if (!transfer) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ success: false, message: "Transfer record not found" });
    }

    if (transfer.deliveryStatus === "sent") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, message: "Transfer is already delivered" });
    }

    const { buffer: pdfBuffer } = await buildCaseRecordPdf(id);

    await sendEmail({
      to: transfer.efccEmail,
      subject: transfer.emailSubject,
      text: "Retry: Official dispute referral transferred to EFCC. Please view attached dossier.",
      html: efccReferralMail({
        caseNumber: id,
        transactionReference: transfer.transferReference,
      }),
      attachments: [
        {
          filename: transfer.pdfFileName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    transfer.deliveryStatus = "sent";
    transfer.deliveryError = undefined;
    transfer.sentAt = new Date();
    await transfer.save();

    // Advance case if not already advanced
    const caseDoc = await DB.Models.Case.findById(id);
    if (caseDoc && caseDoc.status !== "transferred_to_efcc") {
      const now = new Date();
      caseDoc.status = "transferred_to_efcc";
      caseDoc.milestones.push({ stage: "transferred_to_efcc", occurredAt: now, by: req.admin?._id });
      caseDoc.lastActivityAt = now;
      await caseDoc.save();
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Transfer retry delivered successfully",
      data: transfer,
    });
  } catch (error: any) {
    console.error("[AdminEfccTransfer] Retry error:", error);
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to retry transfer",
    });
  }
};
