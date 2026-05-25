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

function parseRoomCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const formatOffPlanProperty = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => ({
  propertyType: "off-plan",
  propertyCategory: payload.propertyCategory,
  propertyCondition: payload.propertyCondition,
  typeOfBuilding: payload.typeOfBuilding,
  price: payload.price ? Number(payload.price) : 0,
  location: {
    state: payload.location?.state,
    localGovernment: payload.location?.localGovernment,
    area: payload.location?.area,
    streetAddress: payload.location?.streetAddress,
  },
  docOnProperty: payload.docOnProperty || [],
  owner: new Types.ObjectId(ownerId),
  ownerModel,
  areYouTheOwner: Boolean(payload.areYouTheOwner),
  features: payload.features || [],
  landSize: {
    measurementType: payload.landSize?.measurementType || "",
    size: Number(payload.landSize?.size) || 0,
  },
  additionalFeatures: {
    noOfBedroom: parseRoomCount(payload.additionalFeatures?.noOfBedroom),
    noOfBathroom: parseRoomCount(payload.additionalFeatures?.noOfBathroom),
    noOfToilet: parseRoomCount(payload.additionalFeatures?.noOfToilet),
    noOfCarPark: parseRoomCount(payload.additionalFeatures?.noOfCarPark),
    ...(payload.additionalFeatures?.noOfSittingRoom != null && {
      noOfSittingRoom: parseRoomCount(payload.additionalFeatures.noOfSittingRoom),
    }),
  },
  tenantCriteria: payload.tenantCriteria || [],
  description: payload.description || "",
  addtionalInfo: payload.addtionalInfo || "",
  pictures: payload.pictures || [],
  videos: payload.videos || [],
  isTenanted: payload.isTenanted,
  holdDuration: payload.holdDuration || "",
  briefType: payload.briefType || "Off-Plan",
  expectedCompletionDate: payload.expectedCompletionDate
    ? String(payload.expectedCompletionDate).trim()
    : undefined,
  developmentStage: payload.developmentStage ? String(payload.developmentStage).trim() : undefined,
  paymentPlan: payload.paymentPlan ? String(payload.paymentPlan).trim() : undefined,
  ownershipDocuments: Array.isArray(payload.ownershipDocuments) ? payload.ownershipDocuments : [],
  listingScope: payload.listingScope,
  createdByRole,
  status: payload.status || "approved",
  isPremium: false,
  inspectionFee: clampInspectionFee(payload.inspectionFee),
  ...(payload.agentCommissionPercent != null && {
    agentCommissionPercent: Math.min(5, Math.max(0, Number(payload.agentCommissionPercent))),
  }),
  ...(payload.agentCommissionAmount != null &&
    payload.agentCommissionAmount >= 0 && {
      agentCommissionAmount: Math.round(Number(payload.agentCommissionAmount)),
    }),
  isApproved: payload.isApproved ?? true,
  isAvailable: payload.isAvailable ?? true,
  isDeleted: false,
  isRejected: false,
});
