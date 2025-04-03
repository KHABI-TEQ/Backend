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
        noOfBedrooms: joi.number().required(),
        additionalFeatures: joi.array().items(joi.string()).optional(),
      })
      .required(),
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
            .required()
            .valid(...Object.values(propertyRent.getPropertyFeatures)),
        })
      )
      .required(),
    tenantCriteria: joi
      .array()
      .items(
        joi.object({
          criteria: joi
            .string()
            .required()
            .valid(...Object.values(propertyRent.getTenantCriteria)),
        })
      )
      .required(),
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
      .required()
      .valid(...Object.values(propertyRent.getPropertyType)),
    location: joi
      .object({
        state: joi.string().required(),
        localGovernment: joi.string().required(),
        area: joi.string().required(),
      })
      .required(),
    budgetMin: joi.number().required(),
    budgetMax: joi.number().required(),
    features: joi.string().optional(),
    minLandSize: joi.number().optional(),
    maxLandSize: joi.number().optional(),
  });

  private propertySellSearchSchema = joi.object({
    propertyType: joi
      .string()
      .required()
      .valid(...Object.values(propertySell.getPropertyType)),
    state: joi.string().required(),
    localGovernment: joi.string().required(),
    area: joi.string().required(),
    minPrice: joi.number().required(),
    maxPrice: joi.number().required(),
    minBedrooms: joi.number().required(),
    maxBedrooms: joi.number().required(),
    usageOptions: joi.array().items(joi.string()).required(),
    additionalFeatures: joi.array().items(joi.string()).optional(),
    minLandSize: joi.number().optional(),
    maxLandSize: joi.number().optional(),
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
