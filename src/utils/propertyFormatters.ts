export const formatPropertyDataForTable = (property: any) => {
  return {
    id: property._id,
    image: property.pictures?.[0] || 'https://placehold.co/600x400/000000/FFFFFF?text=No+Image&font=aenoik',
    
    owner: {
      id: property.owner?._id,
      fullName: property.owner?.fullName || `${property.owner?.firstName || ''} ${property.owner?.lastName || ''}`.trim(),
      // email: property.owner?.email,
      // userType: property.owner?.userType,
      // phoneNumber: property.owner?.phoneNumber,
    },

    propertyType: property.propertyType,
    propertyCategory: property.propertyCategory,
    propertyCondition: property.propertyCondition,
    typeOfBuilding: property.typeOfBuilding,
    rentalType: property.rentalType,
    shortletDuration: property.shortletDuration,
    holdDuration: property.holdDuration,
    price: property.price,

    location: {
      state: property.location?.state,
      localGovernment: property.location?.localGovernment,
      area: property.location?.area,
    },

    landSize: {
      measurementType: property.landSize?.measurementType,
      size: property.landSize?.size,
    },

    docOnProperty: property.docOnProperty || [],
    areYouTheOwner: property.areYouTheOwner,
    features: property.features || [],
    tenantCriteria: property.tenantCriteria || [],

    additionalFeatures: {
      noOfBedrooms: property.additionalFeatures?.noOfBedroom,
      noOfBathrooms: property.additionalFeatures?.noOfBathroom,
      noOfToilets: property.additionalFeatures?.noOfToilet,
      noOfCarParks: property.additionalFeatures?.noOfCarPark,
    },

    jvConditions: property.jvConditions || [],

    shortletDetails: {
      streetAddress: property.shortletDetails?.streetAddress,
      maxGuests: property.shortletDetails?.maxGuests,
      availability: {
        minStay: property.shortletDetails?.availability?.minStay,
      },
      pricing: {
        nightly: property.shortletDetails?.pricing?.nightly,
        weeklyDiscount: property.shortletDetails?.pricing?.weeklyDiscount,
      },
      houseRules: {
        checkIn: property.shortletDetails?.houseRules?.checkIn,
        checkOut: property.shortletDetails?.houseRules?.checkOut,
      },
    },

    pictures: property.pictures || [],
    videos: property.videos || [],
    description: property.description,
    additionalInfo: property.addtionalInfo,

    isTenanted: property.isTenanted,
    isAvailable: property.isAvailable,
    status: property.status,
    reason: property.reason,

    briefType: property.briefType,
    isPremium: property.isPremium,
    isApproved: property.isApproved,
    isRejected: property.isRejected,
    isDeleted: property.isDeleted,

    createdByRole: property.createdByRole,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
};
