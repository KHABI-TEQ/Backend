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

/**
 * @swagger
 * /account/developer/projects:
 *   get:
 *     tags:
 *       - Account > Developer
 *     summary: List developer's off-plan projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Off-plan projects fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/projects/{id}:
 *   get:
 *     tags:
 *       - Account > Developer
 *     summary: Get single off-plan project details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Off-plan project fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/projects:
 *   post:
 *     tags:
 *       - Account > Developer
 *     summary: Create off-plan project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *               totalUnits:
 *                 type: number
 *               unitTypes:
 *                 type: array
 *                 items:
 *                   type: object
 *               startDate:
 *                 type: string
 *                 format: date
 *               expectedCompletionDate:
 *                 type: string
 *                 format: date
 *               priceRange:
 *                 type: object
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Off-plan project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/projects/{id}:
 *   put:
 *     tags:
 *       - Account > Developer
 *     summary: Update off-plan project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *               totalUnits:
 *                 type: number
 *               unitTypes:
 *                 type: array
 *                 items:
 *                   type: object
 *               startDate:
 *                 type: string
 *                 format: date
 *               expectedCompletionDate:
 *                 type: string
 *                 format: date
 *               priceRange:
 *                 type: object
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Off-plan project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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

/**
 * @swagger
 * /account/developer/projects/{id}/submit:
 *   post:
 *     tags:
 *       - Account > Developer
 *     summary: Submit off-plan project for review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project submitted for review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     projectId:
 *                       type: string
 *                     status:
 *                       type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: This action is for Developer accounts only
 */
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
      message: "Project submitted for review. It will go live after an admin approves it.",
      data,
    });
  } catch (err) {
    next(err);
  }
};
