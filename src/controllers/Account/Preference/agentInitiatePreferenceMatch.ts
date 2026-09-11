import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";

/**
 * Agents cannot auto-match marketplace preferences. Matching runs on buyer submit.
 */
export const agentInitiatePreferenceMatch = async (
  _req: AppRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  return next(
    new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Agents cannot auto-match marketplace preferences. Matching is handled by the system when a buyer submits.",
    ),
  );
};
