import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { DB } from "..";

/**
 * Controller to fetch and group system settings.
 */
export const fetchSystemSettings = async (
  req: AppRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.query;
    const systemSetting = DB.Models.SystemSetting;

    // Projection to exclude fields
    const projection = { updatedAt: 0, createdAt: 0, __v: 0 };

    let settings;

    if (category && typeof category === "string") {
      // Fetch settings only by category (include both active and inactive)
      settings = await systemSetting.find({ category }, projection).lean();
      return res.status(HttpStatusCodes.OK).json({
        success: true,
        message: `Settings fetched for category: ${category}`,
        data: settings,
      });
    }

    // Fetch all settings (active + inactive)
    const allSettings = await systemSetting.find({}, projection).lean();

    // Group by category
    const groupedSettings = allSettings.reduce((acc: Record<string, any[]>, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "All system settings fetched and grouped by category",
      data: groupedSettings,
    });

  } catch (err) {
    console.error("Fetch system settings controller error:", err);
    next(err);
  }
};
