import { IProperty } from "../../models";
import { Types } from "mongoose";
import { listingCommissionFields } from "../../common/constants/listingCommission";
import { optionalInspectionFeeNaira } from "../../services/propertyValidation.service";

export const formatShortletProperty = (
  payload: any,
  ownerId: string,
  createdByRole: "user" | "admin",
  ownerModel: "User" | "Admin",
): Partial<IProperty> => ({
  propertyType: payload.propertyType,
  propertyCategory: payload.propertyCategory,
  propertyCondition: payload.propertyCondition,
  typeOfBuilding: payload.typeOfBuilding,
  shortletDuration: payload.shortletDuration,
  price: payload.price ? Number(payload.price) : 0,
  location: {
    state: payload.location?.state,
    localGovernment: payload.location?.localGovernment,
    area: payload.location?.area,
    streetAddress: payload.location?.streetAddress || "",
    estate: payload.location?.estate || "",
  },
  docOnProperty: payload.docOnProperty || [],
  owner: new Types.ObjectId(ownerId),
  areYouTheOwner: Boolean(payload.areYouTheOwner),
  features: payload.features || [],
  additionalFeatures: { 
    noOfBedroom: Number(payload.additionalFeatures?.noOfBedroom) || 0,
    noOfBathroom: Number(payload.additionalFeatures?.noOfBathroom) || 0,
    noOfToilet: Number(payload.additionalFeatures?.noOfToilet) || 0,
    noOfCarPark: Number(payload.additionalFeatures?.noOfCarPark) || 0,
  },
  shortletDetails: {
    streetAddress: payload.location?.streetAddress,
    maxGuests: Number(payload.additionalFeatures?.maxGuests) || 0,
    availability: {
      minStay: Number(payload.availability?.minStay) || 1,
    },
    pricing: {
      nightly: Number(payload.pricing?.nightly) || 0,
      weeklyDiscount: Number(payload.pricing?.weeklyDiscount) || 0,
      monthlyDiscount: Number(payload.pricing?.monthlyDiscount) || 0,
      cleaningFee: Number(payload.pricing?.cleaningFee) || 0,
      securityDeposit: Number(payload.pricing?.securityDeposit) || 0,
    },
    houseRules: {
      checkIn: payload.houseRules?.checkIn || "15:00",
      checkOut: payload.houseRules?.checkOut || "11:00",
      smoking: Boolean(payload.houseRules?.smoking),
      pets: Boolean(payload.houseRules?.pets),
      parties: Boolean(payload.houseRules?.parties),
      otherRules: payload.houseRules?.otherRules || "",
    },
    cancellationPolicy: payload.pricing?.cancellationPolicy || "flexible",
  },
  description: payload.description || "",
  addtionalInfo: payload.addtionalInfo || "",
  pictures: payload.pictures || [],
  videos: payload.videos || [],
  isTenanted: payload.isTenanted,
  briefType: "Shortlet",
  createdByRole: createdByRole,
  ownerModel: ownerModel,
  status: payload.status || "approved",
  isPremium: false,
  inspectionFee: optionalInspectionFeeNaira(payload.inspectionFee),
  ...listingCommissionFields(payload),
  isApproved: payload.isApproved ?? true,
  isAvailable: payload.isAvailable ?? true,
  isDeleted: false,
  isRejected: false,
});
