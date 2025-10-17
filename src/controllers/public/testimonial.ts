import { NextFunction, Response } from "express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";
import { AppRequest } from "../../types/express";

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
