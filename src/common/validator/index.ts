import joi from 'joi';
import { propertyRent, propertySell } from '../constants';
import { RouteError } from '../classes';
import HttpStatusCodes from '../HttpStatusCodes';

enum validatorSchemaNames {
  agentSignupSchema = 'agentSignupSchema',
  agentLoginSchema = 'agentLoginSchema',
  agentOnboardSchema = 'agentOnboardSchema',
  propertySellSchema = 'propertySellSchema',
  propertyRentSchema = 'propertyRentSchema',
  googleSignupSchema = 'googleSignupSchema',
  propertyRentSearchSchema = 'propertyRentSearchSchema',
  propertySellSearchSchema = 'propertySellSearchSchema',
  agentProfileUpdateSchema = 'agentProfileUpdateSchema',
  acctUpgradeSchema = 'acctUpgradeSchema',
}

class Validator {
  private passwordRegex;

  constructor() {
    this.passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{6,}$/;
  }

  private agentSignupSchema = joi.object({
    email: joi.string().email().required(),
    password: joi
      .string()
      .min(8)
      .max(30)
      .custom((value, helpers) => {
        if (!/[A-Z].*[a-z]/.test(value)) {
          return helpers.error('string.minOfUppercase');
        }
        // if (!/[a-z].*[a-z]/.test(value)) {
        //   return helpers.error('string.minOfLowercase');
        // }
        // if (!/[0-9].*[0-9]/.test(value)) {
        //   return helpers.error('string.minOfNumeric');
        // }
        if (!/[^a-zA-Z0-9].*[^a-zA-Z0-9]/.test(value)) {
          return helpers.error('string.minOfSpecialCharacters');
        }
        // if (/\s/.test(value)) {
        //   return helpers.error('string.noWhiteSpaces');
        // }
        // if (!/^[\x00-\x7F]+$/.test(value)) {
        //   return helpers.error('string.onlyLatinCharacters');
        // }
        if (/\bpassword\b/i.test(value)) {
          return helpers.error('string.doesNotInclude');
        }
        return value;
      })
      .messages({
        'string.minOfUppercase': 'Password must contain at least 1 uppercase letters.',
        // 'string.minOfLowercase': 'Password must contain at least 2 lowercase letters.',
        // 'string.minOfNumeric': 'Password must contain at least 2 numbers.',
        'string.minOfSpecialCharacters': 'Password must contain at least 2 special characters.',
        // 'string.noWhiteSpaces': 'Password cannot contain whitespace.',
        // 'string.onlyLatinCharacters': 'Password must contain only Latin characters.',
        'string.doesNotInclude': 'Password cannot include the word "password".',
      })
      .required(),
    lastName: joi.string().required(),
    firstName: joi.string().required(),
    phoneNumber: joi.string().required(),
  });

  private googleSignupSchema = joi.object({
    idToken: joi.string().required(),
  });

  private agentLoginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required(),
  });

  private agentOnboardSchema = joi.object({
    token: joi.string().required(),
    address: joi.object({
      street: joi.string().required(),
      // city: joi.string().required(),
      state: joi.string().required(),
      localGovtArea: joi.string().required(),
    }),
    regionOfOperation: joi.array().items(joi.string()).required(),
    agentType: joi.string().valid('Individual', 'Company').required(),
    companyAgent: joi.object({
      companyName: joi.string().required(),
      // regNumber: joi.string().required(),
    }),
    individualAgent: joi
      .object({
        typeOfId: joi.string().required(),
        // idNumber: joi.string().required(),
      })
      .optional(),
    meansOfId: joi
      .array()
      .items(
        joi.object({
          name: joi.string().required(),
          docImg: joi.array().items(joi.string()).required(),
        })
      )
      .required(),
    phoneNumber: joi.string().required(),
    firstName: joi.string().required(),
    lastName: joi.string().required(),
  });

  private agentProfileUpdateSchema = joi.object({
    address: joi.object({
      street: joi.string().required(),
      // city: joi.string().required(),
      state: joi.string().required(),
      localGovtArea: joi.string().required(),
    }),
    regionOfOperation: joi.array().items(joi.string()).required(),
    phoneNumber: joi.string().required(),
    firstName: joi.string().required(),
    lastName: joi.string().required(),
  });

  private propertySellSchema = joi.object({
    propertyType: joi
      .string()
      .required()
      .valid(...Object.values(propertySell.getPropertyType)),
    location: joi.object({
      state: joi.string().required(),
      localGovernment: joi.string().required(),
      area: joi.string().required(),
    }),
    price: joi.number().required(),
    docOnProperty: joi
      .array()
      .items(
        joi.object({
          docName: joi
            .string()
            .required()
            .valid(...Object.values(propertySell.getDocOnProperty)),
          isProvided: joi.boolean().required(),
        })
      )
      .required(),
    propertyFeatures: joi
      .object({
        noOfBedrooms: joi.number().optional(),
        additionalFeatures: joi.array().items(joi.string()).optional(),
      })
      .optional(),
    areYouTheOwner: joi.boolean().required(),
    owner: joi
      .object({
        fullName: joi.string().required(),
        phoneNumber: joi.string().required(),
        email: joi.string().required(),
      })
      .required(),
    usageOptions: joi.array().items(
      joi
        .string()
        .valid(...Object.values(propertySell.getUsageOptions))
        .required()
    ),
    pictures: joi.array().items(joi.string()).optional(),
    budgetRange: joi.string().optional(),
    landSize: joi
      .object({
        measurementType: joi.string().required(),
        size: joi.number().required(),
      })
      .required(),
  });

  private propertyRentSchema = joi.object({
    propertyType: joi
      .string()
      .required()
      .valid(...Object.values(propertyRent.getPropertyType)),
    propertyCondition: joi
      .string()
      .required()
      .valid(...Object.values(propertyRent.getPropertyCondition)),
    location: joi
      .object({
        state: joi.string().required(),
        localGovernment: joi.string().required(),
        area: joi.string().required(),
      })
      .required(),
    rentalPrice: joi.number().required(),
    noOfBedrooms: joi.number().required(),
    features: joi
      .array()
      .items(
        joi.object({
          featureName: joi
            .string()
            .optional()
            .valid(...Object.values(propertyRent.getPropertyFeatures)),
        })
      )
      .optional(),
    tenantCriteria: joi
      .array()
      .items(
        joi.object({
          criteria: joi
            .string()
            .optional()
            .valid(...Object.values(propertyRent.getTenantCriteria)),
        })
      )
      .optional(),
    owner: joi.object({
      fullName: joi.string().required(),
      phoneNumber: joi.string().required(),
      email: joi.string().required(),
    }),
    areYouTheOwner: joi.boolean().required(),
    pictures: joi.array().items(joi.string()).optional(),
    budgetRange: joi.string().optional(),
  });

  private propertyRentSearchSchema = joi.object({
    propertyType: joi
      .string()
      .optional()
      .valid(...Object.values(propertyRent.getPropertyType)),
    location: joi
      .object({
        state: joi.string().optional(),
        localGovernment: joi.string().optional(),
        area: joi.string().optional(),
      })
      .optional(),
    budgetMin: joi.number().optional(),
    budgetMax: joi.number().optional(),
    features: joi.string().optional(),
    minLandSize: joi.number().optional(),
    maxLandSize: joi.number().optional(),
  });

  private propertySellSearchSchema = joi.object({
    propertyType: joi
      .string()
      .optional()
      .valid(...Object.values(propertySell.getPropertyType)),
    state: joi.string().optional(),
    localGovernment: joi.string().optional(),
    area: joi.string().optional(),
    minPrice: joi.number().optional(),
    maxPrice: joi.number().optional(),
    minBedrooms: joi.number().optional(),
    maxBedrooms: joi.number().optional(),
    usageOptions: joi.array().items(joi.string()).optional(),
    additionalFeatures: joi.array().items(joi.string()).optional(),
    landSize: joi
      .object({
        measurementType: joi.string().optional(),
        size: joi.number().optional(),
      })
      .optional(),
  });

  private acctUpgradeSchema = joi.object({
    companyAgent: joi
      .object({
        companyName: joi.string().required(),
        // regNumber: joi.string().optional(),
      })
      .optional(),
    meansOfId: joi
      .array()
      .items(
        joi.object({
          name: joi.string().required(),
          docImg: joi.array().items(joi.string()).required(),
        })
      )
      .required(),
  });
  public validate(data: any, schemaName: keyof typeof validatorSchemaNames) {
    try {
      const schema = this[schemaName];
      const { error, value } = schema.validate(data);
      //   console.log('error', error);
      if (error) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, error.message);
      }
      return value;
    } catch (error) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, error.message);
    }
  }
}

export default new Validator();
