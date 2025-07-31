import { Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";
import { RouteError } from "../../../common/classes";

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
