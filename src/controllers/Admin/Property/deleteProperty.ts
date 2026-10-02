import { Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";
import { RouteError } from "../../../common/classes";

/**
 * @swagger
 * /admin/properties/{propertyId}/delete:
 *   delete:
 *     tags:
 *       - Admin > Properties
 *     summary: Delete property by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: propertyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */
export const deletePropertyById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    property.status = "deleted";
    property.isAvailable = false;
    property.isRejected = false;
    property.isDeleted = true;
    property.reason = "Deleted by admin";

    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Property with ID ${propertyId} has been marked as deleted.`,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};
