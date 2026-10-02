// controllers/mySettings.ts
import { Response, NextFunction } from "express";
import { AppRequest } from "../../../types/express";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { SystemSettingService } from "../../../services/systemSetting.service";

/**
 * Create a new system setting
 */
export const createSetting = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { key, value, description, category, isEditable } = req.body;

    if (!key || value === undefined) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Key and value are required");
    }

    const setting = await SystemSettingService.createSetting({
      key,
      value,
      description,
      category,
      isEditable,
    });

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Setting created successfully",
      data: setting,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk create or update system settings
 */
/**
 * @swagger
 * /admin/settings/bulk:
 *   post:
 *     tags:
 *       - Admin > Settings
 *     summary: Bulk upsert settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - settings
 *             properties:
 *               settings:
 *                 type: array
 *                 items: {'type': 'object'}
 *                 description: Array of settings objects
 *     responses:
 *       200:
 *         description: Settings bulk upserted successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const bulkUpsertSettings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      throw new RouteError(
        HttpStatusCodes.BAD_REQUEST,
        "Settings array is required"
      );
    }

    const results = [];

    for (const s of settings) {
      if (!s.key || s.value === undefined) {
        throw new RouteError(
          HttpStatusCodes.BAD_REQUEST,
          "Each setting must have a key and value"
        );
      }

      const setting = await SystemSettingService.updateSetting(
        s.key,
        s.value,
        s.description,
        s.category,
        s.status
      );

      results.push(setting);
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Settings upserted successfully",
      data: results,
    });
  } catch (err) {
    next(err);
  }
};



/**
 * Update an existing system setting
 */
export const updateSetting = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { key } = req.params;
    const { value, description, category } = req.body;

    if (!key) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Setting key is required");
    }

    const updated = await SystemSettingService.updateSetting(
      key,
      value,
      description,
      category
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Setting updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single system setting
 */
/**
 * @swagger
 * /admin/settings/{key}:
 *   get:
 *     tags:
 *       - Admin > Settings
 *     summary: Get single setting by key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Setting not found
 */
export const getSetting = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { key } = req.params;

    if (!key) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Setting key is required");
    }

    const setting = await SystemSettingService.getSetting(key);

    if (!setting) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Setting not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Setting fetched successfully",
      data: setting,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all system settings
 */
/**
 * @swagger
 * /admin/settings:
 *   get:
 *     tags:
 *       - Admin > Settings
 *     summary: Get all settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
export const getAllSettings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.query;

    const settings = await SystemSettingService.getAllSettings(
      category ? String(category) : undefined
    );

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Settings fetched successfully",
      data: settings,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a system setting
 */
/**
 * @swagger
 * /admin/settings/{key}/delete:
 *   delete:
 *     tags:
 *       - Admin > Settings
 *     summary: Delete setting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Setting not found
 */
export const deleteSetting = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { key } = req.params;

    if (!key) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Setting key is required");
    }

    const deleted = await SystemSettingService.deleteSetting(key);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Setting not found or already deleted");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Setting deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
