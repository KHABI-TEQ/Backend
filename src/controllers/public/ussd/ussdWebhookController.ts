import { Request, Response } from "express";
import {

/**
 * @swagger
 * /ussd/health:
 *   get:
 *     tags:
 *       - Public
 *     summary: GET /ussd/health
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 * /ussd/webhook:
 *   post:
 *     tags:
 *       - Public
 *     summary: Submit
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */

  formatUssdResponse,
  getUssdAggregator,
  parseUssdRequest,
  verifyUssdWebhook,
} from "../../../services/ussd/ussdProvider.service";
import { getUssdServiceInfo, handleUssdSession } from "../../../services/ussd/ussdSession.service";

/**
 * POST /api/ussd/webhook
 * Africa's Talking, Termii, and generic USSD aggregators POST session updates here.
 * Response body must be plain text: "CON ..." or "END ..."
 */
export const handleUssdWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!verifyUssdWebhook(req)) {
      res.status(401).type("text/plain").send("END Unauthorized");
      return;
    }

    const normalized = parseUssdRequest(req);
    if (!normalized.sessionId || !normalized.phoneNumber) {
      res.status(400).type("text/plain").send("END Invalid USSD request");
      return;
    }

    const result = await handleUssdSession(normalized);
    res.status(200).type("text/plain").send(formatUssdResponse(result));
  } catch (err) {
    console.error("[USSD] Webhook error:", err);
    res.status(200).type("text/plain").send("END Service temporarily unavailable. Please try again.");
  }
};

/** GET /api/ussd/health — ops check without starting a session */
export const ussdHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "USSD webhook is ready",
    data: {
      aggregator: getUssdAggregator(),
      ...getUssdServiceInfo(),
      webhookPath: "/api/ussd/webhook",
    },
  });
};
