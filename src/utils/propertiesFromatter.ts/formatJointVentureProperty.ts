import { IProperty } from "../../models";
import { Types } from "mongoose";

const INSPECTION_FEE_MIN = 1000;
const INSPECTION_FEE_MAX = 50000;
const INSPECTION_FEE_DEFAULT = 5000;
function clampInspectionFee(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return INSPECTION_FEE_DEFAULT;
  return Math.min(INSPECTION_FEE_MAX, Math.max(INSPECTION_FEE_MIN, Math.round(n)));
}

export const formatJointVentureProperty = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => ({
  propertyType: payload.propertyType, // "jv"
  propertyCategory: payload.propertyCategory,
  price: payload.price ? Number(payload.price) : 0,

  location: {
    state: payload.location?.state,
    localGovernment: payload.location?.localGovernment,
    area: payload.location?.area,
    streetAddress: payload.location?.streetAddress || "",
  },

  docOnProperty: payload.docOnProperty || [],
  owner: new Types.ObjectId(ownerId),
  ownerModel: ownerModel,
  areYouTheOwner: Boolean(payload.areYouTheOwner),
  features: payload.features || [],

  additionalFeatures: {
    noOfBedroom: Number(payload.additionalFeatures?.noOfBedroom) || 0,
    noOfBathroom: Number(payload.additionalFeatures?.noOfBathroom) || 0,
    noOfToilet: Number(payload.additionalFeatures?.noOfToilet) || 0,
    noOfCarPark: Number(payload.additionalFeatures?.noOfCarPark) || 0,
  },

  landSize: {
    measurementType: payload.landSize?.measurementType || "",
    size: Number(payload.landSize?.size) || 0,
  },

  jvConditions: payload.jvConditions || [],
  description: payload.description || "",
  addtionalInfo: payload.addtionalInfo || "",
  pictures: payload.pictures || [],
  videos: payload.videos || [],
  isTenanted: payload.isTenanted || "no",
  holdDuration: payload.holdDuration || "",

  briefType: "Joint Venture",
  createdByRole: createdByRole,
  status: payload.status || "approved",
  isPremium: false,
  inspectionFee: clampInspectionFee(payload.inspectionFee),
  isApproved: payload.isApproved ?? true,
  isAvailable: payload.isAvailable ?? true,
  isDeleted: false,
  isRejected: false,
});
