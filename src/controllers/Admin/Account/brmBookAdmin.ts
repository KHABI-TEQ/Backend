import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import {
  getPractitionerJourney,
  listBrmBook,
} from "../../../services/brmPractitionerJourney.service";

/**
 * @swagger
 * /admin/brms/{id}/book:
 *   get:
 *     tags:
 *       - Admin > BRM
 *     summary: Get BRM book/admin booking list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: BRM book fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               {'$ref': '#/components/schemas/Pagination'}
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: BRM not found
 */
export const listBrmBookAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await listBrmBook({
      brmId: req.params.id,
      userType: String(req.query.userType || ""),
      search: String(req.query.search || ""),
      page: parseInt(String(req.query.page || "1"), 10),
      limit: parseInt(String(req.query.limit || "20"), 10),
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/brms/{id}/users/{userId}/journey:
 *   get:
 *     tags:
 *       - Admin > BRM
 *     summary: Get BRM practitioner journey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Practitioner journey fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: BRM or practitioner not found
 */
export const getBrmPractitionerJourneyAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getPractitionerJourney({
      userId: req.params.userId,
      expectedBrmId: req.params.id,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /admin/practitioner-journeys/{userId}:
 *   get:
 *     tags:
 *       - Admin > BRM
 *     summary: Get practitioner journey by user ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Practitioner journey fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practitioner journey not found
 */
export const getPractitionerJourneyAdmin = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getPractitionerJourney({
      userId: req.params.userId,
    });
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
