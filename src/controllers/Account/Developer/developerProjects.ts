import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import {
  createDeveloperProject,
  getDeveloperProject,
  listDeveloperProjects,
  submitDeveloperProject,
  updateDeveloperProject,
} from "../../../services/offPlanProject.service";

function requireDeveloper(req: AppRequest) {
  if (!req.user?._id) {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Not authenticated");
  }
  if ((req.user as { userType?: string }).userType !== "Developer") {
    throw new RouteError(HttpStatusCodes.FORBIDDEN, "This action is for Developer accounts only.");
  }
  return String(req.user._id);
}

export const listMyOffPlanProjects = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await listDeveloperProjects(userId);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMyOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await getDeveloperProject(userId, req.params.id);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createMyOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await createDeveloperProject(userId, req.body);
    return res.status(HttpStatusCodes.CREATED).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateMyOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await updateDeveloperProject(userId, req.params.id, req.body);
    return res.status(HttpStatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const submitMyOffPlanProject = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireDeveloper(req);
    const data = await submitDeveloperProject(userId, req.params.id);
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Project submitted for review.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
