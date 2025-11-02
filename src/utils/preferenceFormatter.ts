// Assuming these are your preference payload interfaces (as provided in the prompt)
interface BuyPreferencePayload {
  _id: string;
  buyer: string;
  preferenceType: "buy";
  preferenceMode: "buy";
  location: {
    state: string;
    localGovernmentAreas?: string[];
    lgasWithAreas?: { lgaName: string; areas: string[] }[];
    customLocation?: string;
  };
  budget: {
    minPrice?: number;
    maxPrice?: number;
    currency: string;
  };
  propertyDetails: {
    propertyType: string;
    buildingType?: string;
    minBedrooms?: string;
    minBathrooms?: number;
    propertyCondition?: string;
    purpose?: string;
    landSize?: string;
    measurementUnit?: string;
    documentTypes?: string[];
    landConditions?: string[];
  };
  features: {
    baseFeatures?: string[];
    premiumFeatures?: string[];
    autoAdjustToFeatures: boolean;
  };
  contactInfo: {
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  nearbyLandmark?: string;
  additionalNotes?: string;
  status: string;
  createdAt: Date;
}

interface RentPreferencePayload {
  _id: string;
  buyer: string;
  preferenceType: "rent";
  preferenceMode: "tenant";
  location: {
    state: string;
    localGovernmentAreas?: string[];
    lgasWithAreas?: { lgaName: string; areas: string[] }[];
    customLocation?: string;
  };
  budget: {
    minPrice?: number;
    maxPrice?: number;
    currency: string;
  };
  propertyDetails: {
    propertyType: string;
    buildingType?: string;
    minBedrooms?: string;
    minBathrooms?: number;
    leaseTerm?: string;
    propertyCondition?: string;
    purpose?: string;
    landSize?: string;
    measurementUnit?: string;
    documentTypes?: string[];
    landConditions?: string[];
  };
  features: {
    baseFeatures?: string[];
    premiumFeatures?: string[];
    autoAdjustToFeatures: boolean;
  };
  contactInfo: {
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  nearbyLandmark?: string;
  additionalNotes?: string;
  status: string;
  createdAt: Date;
}

interface JointVenturePreferencePayload {
  _id: string;
  buyer: string;
  preferenceType: "joint-venture";
  preferenceMode: "developer";
  location: {
    state: string;
    localGovernmentAreas?: string[];
    lgasWithAreas?: { lgaName: string; areas: string[] }[];
    customLocation?: string;
  };
  budget: {
    minPrice?: number;
    maxPrice?: number;
    currency: string;
  };
  developmentDetails: {
    minLandSize?: string;
    measurementUnit?: string;
    jvType?: string;
    propertyType?: string;
    expectedStructureType?: string;
    timeline?: string;
    budgetRange?: string;
    documentTypes?: string[];
    landConditions?: string[];
    buildingType?: string;
    propertyCondition?: string;
    minBedrooms?: string;
    minBathrooms?: number;
    purpose?: string;
  };
  features: {
    baseFeatures?: string[];
    premiumFeatures?: string[];
    autoAdjustToFeatures: boolean;
  };
  contactInfo: {
    companyName?: string;
    contactPerson: string;
    email: string;
    phoneNumber: string;
    cacRegistrationNumber?: string;
  };
  partnerExpectations?: string;
  nearbyLandmark?: string;
  additionalNotes?: string;
  status: string;
  createdAt: Date;
}

interface ShortletPreferencePayload {
  _id: string;
  buyer: string;
  preferenceType: "shortlet";
  preferenceMode: "shortlet";
  location: {
    state: string;
    localGovernmentAreas?: string[];
    lgasWithAreas?: { lgaName: string; areas: string[] }[];
    customLocation?: string;
  };
  budget: {
    minPrice?: number;
    maxPrice?: number;
    currency: string;
  };
  bookingDetails: {
    propertyType?: string;
    buildingType?: string;
    minBedrooms?: string;
    minBathrooms?: number;
    numberOfGuests?: number;
    checkInDate?: string;
    checkOutDate?: string;
    travelType?: string;
    preferredCheckInTime?: string;
    preferredCheckOutTime?: string;
    propertyCondition?: string;
    purpose?: string;
    landSize?: string;
    measurementUnit?: string;
    documentTypes?: string[];
    landConditions?: string[];
  };
  features: {
    baseFeatures?: string[];
    premiumFeatures?: string[];
    autoAdjustToFeatures: boolean;
  };
  contactInfo: {
    fullName: string;
    email: string;
    phoneNumber: string;
    petsAllowed?: boolean;
    smokingAllowed?: boolean;
    partiesAllowed?: boolean;
    additionalRequests?: string;
    maxBudgetPerNight?: number;
    willingToPayExtra?: boolean;
    cleaningFeeBudget?: number;
    securityDepositBudget?: number;
    cancellationPolicy?: string;
    preferredCheckInTime?: string;
    preferredCheckOutTime?: string;
  };
  nearbyLandmark?: string;
  additionalNotes?: string;
  status: string;
  createdAt: Date;
}

export type PreferencePayload =
  | BuyPreferencePayload
  | RentPreferencePayload
  | JointVenturePreferencePayload
  | ShortletPreferencePayload;

export function formatPreferenceForFrontend(preference: PreferencePayload): { [key: string]: any } {
  const formattedData: { [key: string]: any } = {
    preferenceId: preference._id,
    buyer: preference.buyer,
    status: preference.status,
    preferenceType: preference.preferenceType,
    preferenceMode: preference.preferenceMode,
    location: {},
    budget: {},
    features: {},
    contactInfo: {},
  };

  // Location Details
  if (preference.location) {
    if (preference.location.state) formattedData.location.state = preference.location.state;
    if (preference.location.localGovernmentAreas && preference.location.localGovernmentAreas.length > 0) {
      formattedData.location.localGovernmentAreas = preference.location.localGovernmentAreas;
    }
    if (preference.location.lgasWithAreas && preference.location.lgasWithAreas.length > 0) {
      formattedData.location.lgasWithAreas = preference.location.lgasWithAreas;
    }
    if (preference.location.customLocation) {
      formattedData.location.customLocation = preference.location.customLocation;
    }
  }

  // Budget Details
  if (preference.budget) {
    if (preference.budget.minPrice) formattedData.budget.minPrice = preference.budget.minPrice;
    if (preference.budget.maxPrice) formattedData.budget.maxPrice = preference.budget.maxPrice;
    if (preference.budget.currency) formattedData.budget.currency = preference.budget.currency;
  }
 
  // Type-specific details
  switch (preference.preferenceType) {
    case "buy":
      const buyDetails = (preference as BuyPreferencePayload).propertyDetails;
      formattedData.propertyDetails = {};
      if (buyDetails.propertyType) formattedData.propertyDetails.propertyType = buyDetails.propertyType;
      if (buyDetails.buildingType) formattedData.propertyDetails.buildingType = buyDetails.buildingType;
      if (buyDetails.minBedrooms) formattedData.propertyDetails.minBedrooms = buyDetails.minBedrooms;
      if (buyDetails.minBathrooms) formattedData.propertyDetails.minBathrooms = buyDetails.minBathrooms;
      if (buyDetails.propertyCondition) formattedData.propertyDetails.propertyCondition = buyDetails.propertyCondition;
      if (buyDetails.purpose) formattedData.propertyDetails.purpose = buyDetails.purpose;
      if (buyDetails.landSize) formattedData.propertyDetails.landSize = buyDetails.landSize;
      if (buyDetails.measurementUnit) formattedData.propertyDetails.measurementUnit = buyDetails.measurementUnit;
      if (buyDetails.documentTypes && buyDetails?.documentTypes.length > 0) {
        formattedData.propertyDetails.documentTypes = buyDetails.documentTypes;
      }
      if (buyDetails.landConditions && buyDetails.landConditions.length > 0) {
        formattedData.propertyDetails.landConditions = buyDetails.landConditions;
      }
      break;

    case "rent":
      const rentDetails = (preference as RentPreferencePayload).propertyDetails;
      formattedData.propertyDetails = {};
      if (rentDetails.propertyType) formattedData.propertyDetails.propertyType = rentDetails.propertyType;
      if (rentDetails.buildingType) formattedData.propertyDetails.buildingType = rentDetails.buildingType;
      if (rentDetails.minBedrooms) formattedData.propertyDetails.minBedrooms = rentDetails.minBedrooms;
      if (rentDetails.minBathrooms) formattedData.propertyDetails.minBathrooms = rentDetails.minBathrooms;
      if (rentDetails.leaseTerm) formattedData.propertyDetails.leaseTerm = rentDetails.leaseTerm;
      if (rentDetails.propertyCondition) formattedData.propertyDetails.propertyCondition = rentDetails.propertyCondition;
      if (rentDetails.purpose) formattedData.propertyDetails.purpose = rentDetails.purpose;
      if (rentDetails.landSize) formattedData.propertyDetails.landSize = rentDetails.landSize;
      if (rentDetails.measurementUnit) formattedData.propertyDetails.measurementUnit = rentDetails.measurementUnit;
      if (rentDetails.documentTypes && rentDetails?.documentTypes.length > 0) {
        formattedData.propertyDetails.documentTypes = rentDetails.documentTypes;
      }
      if (rentDetails.landConditions && rentDetails?.landConditions.length > 0) {
        formattedData.propertyDetails.landConditions = rentDetails.landConditions;
      }
      break;

    case "joint-venture":
      const jvDetails = (preference as JointVenturePreferencePayload).developmentDetails;
      formattedData.developmentDetails = {};
      if (jvDetails?.minLandSize) formattedData.developmentDetails.minLandSize = jvDetails.minLandSize;
      if (jvDetails?.measurementUnit) formattedData.developmentDetails.measurementUnit = jvDetails.measurementUnit;
      if (jvDetails?.jvType) formattedData.developmentDetails.jvType = jvDetails.jvType;
      if (jvDetails?.propertyType) formattedData.developmentDetails.propertyType = jvDetails.propertyType;
      if (jvDetails?.expectedStructureType) formattedData.developmentDetails.expectedStructureType = jvDetails.expectedStructureType;
      if (jvDetails?.timeline) formattedData.developmentDetails.timeline = jvDetails.timeline;
      if (jvDetails?.budgetRange) formattedData.developmentDetails.budgetRange = jvDetails.budgetRange;
      if (jvDetails?.documentTypes && jvDetails?.documentTypes.length > 0) {
        formattedData.developmentDetails.documentTypes = jvDetails.documentTypes;
      }
      if (jvDetails?.landConditions && jvDetails?.landConditions.length > 0) {
        formattedData.developmentDetails.landConditions = jvDetails.landConditions;
      }
      if (jvDetails?.buildingType) formattedData.developmentDetails.buildingType = jvDetails.buildingType;
      if (jvDetails?.propertyCondition) formattedData.developmentDetails.propertyCondition = jvDetails.propertyCondition;
      if (jvDetails?.minBedrooms) formattedData.developmentDetails.minBedrooms = jvDetails.minBedrooms;
      if (jvDetails?.minBathrooms) formattedData.developmentDetails.minBathrooms = jvDetails.minBathrooms;
      if (jvDetails?.purpose) formattedData.developmentDetails.purpose = jvDetails.purpose;
      break;

    case "shortlet":
      const shortletDetails = (preference as ShortletPreferencePayload).bookingDetails;
      formattedData.bookingDetails = {};
      if (shortletDetails?.propertyType) formattedData.bookingDetails.propertyType = shortletDetails.propertyType;
      if (shortletDetails?.buildingType) formattedData.bookingDetails.buildingType = shortletDetails.buildingType;
      if (shortletDetails?.minBedrooms) formattedData.bookingDetails.minBedrooms = shortletDetails.minBedrooms;
      if (shortletDetails?.minBathrooms) formattedData.bookingDetails.minBathrooms = shortletDetails.minBathrooms;
      if (shortletDetails?.numberOfGuests) formattedData.bookingDetails.numberOfGuests = shortletDetails.numberOfGuests;
      if (shortletDetails?.checkInDate) formattedData.bookingDetails.checkInDate = shortletDetails.checkInDate;
      if (shortletDetails?.checkOutDate) formattedData.bookingDetails.checkOutDate = shortletDetails.checkOutDate;
      if (shortletDetails?.travelType) formattedData.bookingDetails.travelType = shortletDetails.travelType;
      if (shortletDetails?.preferredCheckInTime) formattedData.bookingDetails.preferredCheckInTime = shortletDetails.preferredCheckInTime;
      if (shortletDetails?.preferredCheckOutTime) formattedData.bookingDetails.preferredCheckOutTime = shortletDetails.preferredCheckOutTime;
      if (shortletDetails?.propertyCondition) formattedData.bookingDetails.propertyCondition = shortletDetails.propertyCondition;
      if (shortletDetails?.purpose) formattedData.bookingDetails.purpose = shortletDetails.purpose;
      break;
  }

  // Features
  if (preference.features) {
    if (preference.features?.baseFeatures && preference.features?.baseFeatures.length > 0) {
      formattedData.features.baseFeatures = preference.features.baseFeatures;
    }
    if (preference.features?.premiumFeatures && preference.features?.premiumFeatures.length > 0) {
      formattedData.features.premiumFeatures = preference.features.premiumFeatures;
    }
    formattedData.features.autoAdjustToFeatures = preference.features.autoAdjustToFeatures;
  }

  // Contact Info
  if (preference.contactInfo) {
    if (preference.preferenceType === "joint-venture") {
      const contact = (preference as JointVenturePreferencePayload).contactInfo;
      if (contact?.companyName) formattedData.contactInfo.companyName = contact.companyName;
      if (contact?.contactPerson) formattedData.contactInfo.contactPerson = contact.contactPerson;
      if (contact?.email) formattedData.contactInfo.email = contact.email;
      if (contact?.phoneNumber) formattedData.contactInfo.phoneNumber = contact.phoneNumber;
      if (contact?.cacRegistrationNumber) formattedData.contactInfo.cacRegistrationNumber = contact.cacRegistrationNumber;
    } else if (preference.preferenceType === "shortlet") {
      const contact = (preference as ShortletPreferencePayload).contactInfo;
      if (contact?.fullName) formattedData.contactInfo.fullName = contact.fullName;
      if (contact?.email) formattedData.contactInfo.email = contact.email;
      if (contact?.phoneNumber) formattedData.contactInfo.phoneNumber = contact.phoneNumber;
      formattedData.contactInfo.petsAllowed = contact.petsAllowed;
      formattedData.contactInfo.smokingAllowed = contact.smokingAllowed;
      formattedData.contactInfo.partiesAllowed = contact.partiesAllowed;
      if (contact?.additionalRequests) formattedData.contactInfo.additionalRequests = contact.additionalRequests;
      if (contact?.maxBudgetPerNight) formattedData.contactInfo.maxBudgetPerNight = contact.maxBudgetPerNight;
      formattedData.contactInfo.willingToPayExtra = contact.willingToPayExtra;
      if (contact?.cleaningFeeBudget) formattedData.contactInfo.cleaningFeeBudget = contact.cleaningFeeBudget;
      if (contact?.securityDepositBudget) formattedData.contactInfo.securityDepositBudget = contact.securityDepositBudget;
      if (contact?.cancellationPolicy) formattedData.contactInfo.cancellationPolicy = contact.cancellationPolicy;
      if (contact?.preferredCheckInTime) formattedData.contactInfo.preferredCheckInTime = contact.preferredCheckInTime;
      if (contact?.preferredCheckOutTime) formattedData.contactInfo.preferredCheckOutTime = contact.preferredCheckOutTime;
    } else {
      const contact = (preference as BuyPreferencePayload | RentPreferencePayload).contactInfo;
      if (contact?.fullName) formattedData.contactInfo.fullName = contact.fullName;
      if (contact?.email) formattedData.contactInfo.email = contact.email;
      if (contact?.phoneNumber) formattedData.contactInfo.phoneNumber = contact.phoneNumber;
    }
  }

  // General Additional Info
  if (preference?.nearbyLandmark) {
    formattedData.nearbyLandmark = preference.nearbyLandmark;
  }
  if (preference?.additionalNotes) {
    formattedData.additionalNotes = preference.additionalNotes;
  }

  if ((preference as JointVenturePreferencePayload).partnerExpectations) {
    formattedData.partnerExpectations = (preference as JointVenturePreferencePayload).partnerExpectations;
  }

  formattedData.createdAt = preference.createdAt;

  return formattedData;
}