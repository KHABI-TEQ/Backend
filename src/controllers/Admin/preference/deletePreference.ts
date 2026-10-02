import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

/**
 * @swagger
 * /admin/preferences/{preferenceId}/delete:
 *   delete:
 *     tags:
 *       - Admin > Preferences
 *     summary: Delete preference
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: preferenceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Preference deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Preference not found
 */
export const deletePreference = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { preferenceId } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(preferenceId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid preference ID");
    }

    // Find preference
    const preference = await DB.Models.Preference.findById(preferenceId);
    if (!preference) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Preference not found");
    }

    // Delete preference
    await DB.Models.Preference.findByIdAndDelete(preferenceId);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Preference deleted successfully",
      data: { _id: preferenceId },
    });
  } catch (err) {
    next(err);
  }
};
