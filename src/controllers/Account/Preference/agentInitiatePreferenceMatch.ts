import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

/**
 * Agents cannot auto-match marketplace preferences. Matching runs on buyer submit.
 */
/**
 * @swagger
 * /account/marketplace/preferences/{preferenceId}/match:
 *   post:
 *     tags:
 *       - Account > Preferences
 *     summary: Initiate preference match (returns forbidden; agents cannot auto-match)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: preferenceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Preference ID
 *     responses:
 *       403:
 *         description: Agents cannot auto-match marketplace preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                     type: string
 */
export const agentInitiatePreferenceMatch = async (
  _req: AppRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  return next(
    new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Agents cannot auto-match marketplace preferences. Matching is handled by the system when a buyer submits.",
    ),
  );
};
