class PropertySell {
  private propertyType = {
    residential: 'Residential',
    commercial: 'Commercial',
    land: 'Land',
  };

  private docOnProperty = {
    surveyDoc: 'Survey Document',
    deedOfAssignment: 'Deed of Assignment',
    receipt: 'Receipt',
    cOfO: 'C of O',
    governorConsent: 'Governor Consent',
    landCertificate: 'Land Certificate',
    deedOfConveyance: 'Registered deed of conveyance',
  };

  private usageOptions = {
    outRightSale: 'Outright Sale',
    lease: 'Lease',
    all: 'All',
    jointVenture: 'Joint Venture',
  };

  public get getPropertyType() {
    return this.propertyType;
  }

  public get getDocOnProperty() {
    return this.docOnProperty;
  }
  public get getUsageOptions() {
    return this.usageOptions;
  }
}

class PropertyRent {
  private propertyType = {
    residential: 'Residential',
    commercial: 'Commercial',
    land: 'Land',
  };

  private propertyCondition = {
    new: 'New Building',
    old: 'Old Building',
  };

  private propertyFeatures = {
    popCeilings: 'POP Ceilings',
    // security: 'Security',
    waterHeaters: 'Water Heaters',
    electricity: 'Electricity',
    closets: 'Closets',
    bathTubs: 'Bath Tub',
    chandeliers: 'Chandeliers',
    secureEstate: 'Secure Estate',
    balconies: 'Balconies',
    parking: 'Parking',
    spaciousCompound: 'Spacious Compound',
    cctv: 'CCTV',
    spaciousDiningArea: 'Spacious Dining Area',
    furnished: 'Furnished',
    unfurnished: 'Unfurnished',
  };

  private tenantCriteria = {
    noPets: 'No Pets Allowed',
    corporateTenants: 'Corporate Tenants',
    male: 'Male',
    bothGender: 'Both Gender',
    creditReportRequired: 'Must Provide Credit Report',
    individualTenants: 'Individual Tenant',
    female: 'Female',
    employee: 'Employee',
    selfEmployed: 'Self Employed',
    responsibleForBasicMaintenance: 'Tenant Responsible for Basic Maintenance',
  };

  public get getPropertyType() {
    return this.propertyType;
  }

  public get getPropertyCondition() {
    return this.propertyCondition;
  }

  public get getPropertyFeatures() {
    return this.propertyFeatures;
  }

  public get getTenantCriteria() {
    return this.tenantCriteria;
  }
}

class PropertyOwner {
  private ownerType = {
    seller: 'Seller',
    landlord: 'LandLord',
    buyer: 'Buyer',
  };

  public get getOwnerType() {
    return this.ownerType;
  }
}

class Others {
  private CONSTATNTS = {
    jwtExpire: '12h',
  };

  public getConstants() {
    return this.CONSTATNTS;
  }
}

const propertySell = new PropertySell();
const propertyRent = new PropertyRent();
const propertyOwner = new PropertyOwner();
const otherConstants = new Others();

export { propertySell, propertyRent, propertyOwner, otherConstants };
