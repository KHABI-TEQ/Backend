import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {

/**
 * @swagger
 * /preferences/{preferenceId}/getOne:
 *   get:
 *     tags:
 *       - Public
 *     summary: GET /preferences/{preferenceId}/getOne
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
 */

  formatPreferenceForFrontend,
  stripPreferenceClientIdentity,
  PreferencePayload,
} from "../../../utils/preferenceFormatter";

export const fetchSinglePreference = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { preferenceId } = req.params;

    if (!preferenceId) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Preference ID is required");
    }

    const preference = await DB.Models.Preference.findById(preferenceId)
      .populate("buyer");

    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    const plainObj = preference.toObject({ getters: true, virtuals: true });
    const formatted = stripPreferenceClientIdentity(
      formatPreferenceForFrontend(plainObj as unknown as PreferencePayload)
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference fetched successfully",
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
};
