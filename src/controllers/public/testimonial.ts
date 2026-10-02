import { NextFunction, Response } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";

/**
 * @swagger
 * /testimonials:
 *   get:
 *     tags:
 *       - Public
 *     summary: GET /testimonials
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: OK
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */


// Fetch Latest Approved Testimonials (Public)
export const getLatestApprovedTestimonials = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const testimonials = await DB.Models.Testimonial.find({
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: testimonials,
    });
  } catch (err) {
    next(err);
  }
};
