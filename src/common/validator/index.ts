import joi from 'joi';
import { propertyRent, propertySell } from '../constants';
import { RouteError } from '../classes';
import HttpStatusCodes from '../HttpStatusCodes';

enum validatorSchemaNames {
  userSignupSchema = 'userSignupSchema',
  userLoginSchema = 'userLoginSchema',
  agentOnboardSchema = 'agentOnboardSchema',
  googleSignupSchema = 'googleSignupSchema',
  agentProfileUpdateSchema = 'agentProfileUpdateSchema',
  acctUpgradeSchema = 'acctUpgradeSchema',
}

class Validator {
  private passwordRegex;

  constructor() {
    this.passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{6,}$/;
  }

  // private agentSignupSchema = joi.object({
  //   email: joi.string().email().required(),
  //   password: joi
  //     .string()
  //     .min(8)
  //     .max(30)
  //     .custom((value, helpers) => {
  //       if (!/[A-Z].*[a-z]/.test(value)) {
  //         return helpers.error('string.minOfUppercase');
  //       }
  //       // if (!/[a-z].*[a-z]/.test(value)) {
  //       //   return helpers.error('string.minOfLowercase');
  //       // }
  //       // if (!/[0-9].*[0-9]/.test(value)) {
  //       //   return helpers.error('string.minOfNumeric');
  //       // }
  //       if (!/[^a-zA-Z0-9].*[^a-zA-Z0-9]/.test(value)) {
  //         return helpers.error('string.minOfSpecialCharacters');
  //       }
  //       // if (/\s/.test(value)) {
  //       //   return helpers.error('string.noWhiteSpaces');
  //       // }
  //       // if (!/^[\x00-\x7F]+$/.test(value)) {
  //       //   return helpers.error('string.onlyLatinCharacters');
  //       // }
  //       if (/\bpassword\b/i.test(value)) {
  //         return helpers.error('string.doesNotInclude');
  //       }
  //       return value;
  //     })
  //     .messages({
  //       'string.minOfUppercase': 'Password must contain at least 1 uppercase letters.',
  //       // 'string.minOfLowercase': 'Password must contain at least 2 lowercase letters.',
  //       // 'string.minOfNumeric': 'Password must contain at least 2 numbers.',
  //       'string.minOfSpecialCharacters': 'Password must contain at least 2 special characters.',
  //       // 'string.noWhiteSpaces': 'Password cannot contain whitespace.',
  //       // 'string.onlyLatinCharacters': 'Password must contain only Latin characters.',
  //       'string.doesNotInclude': 'Password cannot include the word "password".',
  //     })
  //     .required(),
  //   lastName: joi.string().required(),
  //   firstName: joi.string().required(),
  //   phoneNumber: joi.string().required(),
  // });

  private userSignupSchema = joi.object({
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
    userType: joi.string().valid('Agent', 'Landowners').required(),
    referralCode:joi.string().optional()
  });

  private googleSignupSchema = joi.object({
    code: joi.string().required(),
    userType: joi.string().valid('Agent', 'Landowners').required(),
  });

  private userLoginSchema = joi.object({
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
