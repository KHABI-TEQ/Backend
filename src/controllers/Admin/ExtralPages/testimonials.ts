import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

// Create testimonial
export const createTestimonial = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const testimonial = await DB.Models.Testimonial.create(req.body);
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Testimonial created successfully",
      data: testimonial,
    });
  } catch (err) {
    next(err);
  }
};

// Update testimonial
export const updateTestimonial = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { testimonialId } = req.params;

    if (!mongoose.isValidObjectId(testimonialId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid testimonial ID");
    }

    const updated = await DB.Models.Testimonial.findByIdAndUpdate(testimonialId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Testimonial not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Testimonial updated successfully",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Get a single testimonial
export const getTestimonial = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { testimonialId } = req.params;

    if (!mongoose.isValidObjectId(testimonialId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid testimonial ID");
    }

    const testimonial = await DB.Models.Testimonial.findById(testimonialId);

    if (!testimonial) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Testimonial not found");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Testimonial fetched successfully",
      data: testimonial,
    });
  } catch (err) {
    next(err);
  }
};

// Get all testimonials
export const getAllTestimonials = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter: any = {};
    if (search) filter.fullName = { $regex: search as string, $options: "i" };
    if (status && status !== "all") filter.status = status;

    const skip = (+page - 1) * +limit;

    const [testimonials, total] = await Promise.all([
      DB.Models.Testimonial.find(filter)
        .sort({ [sortBy as string]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(+limit),
      DB.Models.Testimonial.countDocuments(filter),
    ]);

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Testimonials fetched successfully",
      data: testimonials,
      pagination: {
        total,
        page: +page,
        limit: +limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get latest approved testimonials (limit 10)
export const getLatestApprovedTestimonials = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const testimonials = await DB.Models.Testimonial.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Latest approved testimonials fetched successfully",
      data: testimonials,
    });
  } catch (err) {
    next(err);
  }
};

// Delete testimonial
export const deleteTestimonial = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { testimonialId } = req.params;

    if (!mongoose.isValidObjectId(testimonialId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid testimonial ID");
    }

    const deleted = await DB.Models.Testimonial.findByIdAndDelete(testimonialId);

    if (!deleted) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Testimonial not found or already deleted");
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Testimonial deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Update testimonial status
export const updateTestimonialStatus = async (req: AppRequest, res: Response, next: NextFunction) => {
  try {
    const { testimonialId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(testimonialId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid testimonial ID");
    }

    const allowedStatuses = ["pending", "approved", "rejected"];
    if (!status || !allowedStatuses.includes(status)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid status. Must be 'pending', 'approved' or 'rejected'.");
    }

    const testimonial = await DB.Models.Testimonial.findById(testimonialId);
    if (!testimonial) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, "Testimonial not found");
    }

    testimonial.status = status;
    testimonial.updatedAt = new Date();
    await testimonial.save();

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: `Testimonial status updated to '${status}' successfully`,
      data: testimonial,
    });
  } catch (err) {
    next(err);
  }
};
