export const formatPropertyDataForTable = (property: any) => {
  return {
    id: property._id,
    image: property.pictures?.[0] || 'https://placehold.co/600x400/000000/FFFFFF?text=No+Image&font=aenoik',
    owner: {
      id: property.owner?._id,
      fullName: property.owner?.fullName || `${property.owner?.firstName || ''} ${property.owner?.lastName || ''}`,
      email: property.owner?.email,
      userType: property.owner?.userType,
      phoneNumber: property.owner?.phoneNumber,
    },
    propertyType: property.propertyType,
    briefType: property.briefType,
    price: property.price,
    isApproved: property.isApproved,
    isRejected: property.isRejected,
    isAvailable: property.isAvailable,
    isPremium: property.isPremium,
    isPreference: property.isPreference,
    buildingType: property.buildingType,
    location: {
      state: property.location?.state,
      localGovernment: property.location?.localGovernment,
      area: property.location?.area,
    },
    additionalFeatures: {
      noOfBedrooms: property.additionalFeatures?.noOfBedrooms,
      noOfBathrooms: property.additionalFeatures?.noOfBathrooms,
      noOfToilets: property.additionalFeatures?.noOfToilets,
      noOfCarParks: property.additionalFeatures?.noOfCarParks,
    },
    createdAt: property.createdAt,
  };
}
