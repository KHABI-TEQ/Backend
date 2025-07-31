import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
 
export const deleteProperty = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    // Fetch property from DB
    const property = await DB.Models.Property.findById(propertyId);
    if (!property) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Property not found");
    }

    // Check ownership or admin privilege
    if (
      property.owner.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      throw new RouteError(
        HttpStatusCodes.FORBIDDEN,
        "You do not have permission to delete this property",
      );
    }

    // Send mail to the owner

    // Soft delete: Set isDeleted to true and status to "deleted"
    property.isDeleted = true;
    property.isAvailable = false;
    property.isRejected = false;
    property.status = "deleted";
    await property.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Property marked as deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
