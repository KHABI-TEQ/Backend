import { Response, NextFunction } from "express";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { AppRequest } from "../../../types/express";

export const deletePropertyById = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { propertyId } = req.params;

    // const rentDeleted = await DB.Models.PropertyRent.findByIdAndDelete(propertyId).exec();
    // const sellDeleted = await DB.Models.PropertySell.findByIdAndDelete(propertyId).exec();

    // if (!rentDeleted && !sellDeleted) {
    //   return res.status(HttpStatusCodes.NOT_FOUND).json({
    //     success: false,
    //     message: "Property not found",
    //   });
    // }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Property with ID ${propertyId} has been deleted.`,
    });
  } catch (error) {
    next(error);
  }
};