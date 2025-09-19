import { IProperty } from "../../models";
import { Types } from "mongoose";

export const formatBuyProperty = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => ({
  propertyType: payload.propertyType, // e.g. "sell"
  propertyCategory: payload.propertyCategory,
  propertyCondition: payload.propertyCondition,
  typeOfBuilding: payload.typeOfBuilding,
  price: payload.price ? Number(payload.price) : 0,

  location: {
    state: payload.location?.state,
    localGovernment: payload.location?.localGovernment,
    area: payload.location?.area,
    streetAddress: payload.location?.streetAddress
  },

  docOnProperty: payload.docOnProperty || [],
  owner: new Types.ObjectId(ownerId),
  ownerModel: ownerModel,
  areYouTheOwner: Boolean(payload.areYouTheOwner),
  features: payload.features || [],

  landSize: {
    measurementType: payload.landSize?.measurementType || "",
    size: Number(payload.landSize?.size) || 0,
  },

  additionalFeatures: {
    noOfBedroom: Number(payload.additionalFeatures?.noOfBedroom) || 0,
    noOfBathroom: Number(payload.additionalFeatures?.noOfBathroom) || 0,
    noOfToilet: Number(payload.additionalFeatures?.noOfToilet) || 0,
    noOfCarPark: Number(payload.additionalFeatures?.noOfCarPark) || 0,
  },

  tenantCriteria: payload.tenantCriteria || [],
  description: payload.description || "",
  addtionalInfo: payload.addtionalInfo || "",
  pictures: payload.pictures || [],
  videos: payload.videos || [],
  isTenanted: payload.isTenanted,
  holdDuration: payload.holdDuration || "",
  briefType: "Outright Sales", // fixed for Buy
  createdByRole: createdByRole,
  status: payload.status || "pending", // default pending if not sent
  isPremium: false,
  isApproved: false,
  isDeleted: false,
  isRejected: false,
});
