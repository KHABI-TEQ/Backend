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

export const formatRentProperty = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => ({
  propertyType: payload.propertyType,
  propertyCategory: payload.propertyCategory,
  propertyCondition: payload.propertyCondition,
  typeOfBuilding: payload.typeOfBuilding,
  rentalType: payload.rentalType,
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
  tenantCriteria: payload.tenantCriteria || [],
  description: payload.description || "",
  addtionalInfo: payload.addtionalInfo || "",
  pictures: payload.pictures || [],
  videos: payload.videos || [],
  isTenanted: payload.isTenanted || "no",
  holdDuration: payload.holdDuration || "",
  rentalConditions: {
    conditions: payload.rentalConditions || [],
    tenantGenderPreference: payload.tenantGenderPreference || "",
  },
  employmentType: payload.employmentType || "",
  leaseHold: payload.leaseHold || "",
  briefType: "Rent",
  createdByRole: createdByRole,
  status: payload.status || "approved",
  isPremium: false,
  inspectionFee: clampInspectionFee(payload.inspectionFee),
  isApproved: payload.isApproved ?? true,
  isAvailable: payload.isAvailable ?? true,
  isDeleted: false,
  isRejected: false,
});
