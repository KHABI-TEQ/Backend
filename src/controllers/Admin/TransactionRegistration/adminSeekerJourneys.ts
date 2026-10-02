import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  getSeekerJourneyByPreferenceId,
  listSeekerJourneys,
} from "../../../services/seekerJourneyTrail.service";

/**
 * @swagger
 * /admin/transaction-registrations/journeys:
 *   get:
 *     tags:
 *       - Admin > Transaction Registration
 *     summary: List all seeker journeys
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seeker journeys fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const listAdminSeekerJourneys = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = "1", limit = "20", insured, search } = req.query as {
      page?: string;
      limit?: string;
      insured?: string;
      search?: string;
    };
    const data = await listSeekerJourneys({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      insured: insured === "yes" || insured === "no" ? insured : undefined,
      search,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: data.journeys,
      pagination: data.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/transaction-registrations/journeys/{journeyId}:
 *   get:
 *     tags:
 *       - Admin > Transaction Registration
 *     summary: Get seeker journey details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: journeyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seeker journey fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Journey not found
 */
export const getAdminSeekerJourney = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const journey = await getSeekerJourneyByPreferenceId(req.params.preferenceId);
    if (!journey) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Seeker journey not found");
    }
    return res.status(HttpStatusCodes.OK).json({ success: true, data: journey });
  } catch (err) {
    next(err);
  }
};
