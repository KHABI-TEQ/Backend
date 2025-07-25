import { IInspectionBookingDoc } from "../models";

export const formatInspectionForTable = (inspection: IInspectionBookingDoc) => {
  const property = inspection.propertyId as any;

  return {
    id: inspection._id,
    property: property
      ? {
          id: property._id,
          title: `${property?.location?.area}, ${property?.location?.localGovernment}, ${property?.location?.state}`,
          price: property?.price,
          image: property?.pictures?.[0] || "https://placehold.co/600x400?text=No+Image",
          status: property?.status,
          briefType: property?.briefType,
          isAvailable: property?.isAvailable,
        }
      : null,

    inspectionDate: inspection.inspectionDate,
    inspectionTime: inspection.inspectionTime,
    inspectionType: inspection.inspectionType,
    inspectionMode: inspection.inspectionMode,
    inspectionStatus: inspection.inspectionStatus,
    status: inspection.status,
    isNegotiating: inspection.isNegotiating,
    isLOI: inspection.isLOI,
    owner: inspection.owner,
    negotiationPrice: inspection.negotiationPrice,
    counterCount: inspection.counterCount,
    reason: inspection.reason || null,
    pendingResponseFrom: inspection.pendingResponseFrom,
    stage: inspection.stage,
    createdAt: inspection.createdAt,
    updatedAt: inspection.updatedAt,
  };
};
