import { Response, NextFunction } from "express";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { AppRequest } from "../types/express";
import Joi from "joi";

export const validateJoi = (schema: Joi.ObjectSchema<any>) => {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((d: any) => d.message);
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    next();
  };
};
