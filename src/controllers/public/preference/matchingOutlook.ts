import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { matchingOutlook } from "../../../services/preferenceReview.service";

/**
 * @swagger
 * /preferences/matching-outlook:
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


export const getPreferenceMatchingOutlook = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await matchingOutlook(req.body || {});
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Matching outlook estimated.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
