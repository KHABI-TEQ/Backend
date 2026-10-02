import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import { DB } from "../..";
import HttpStatusCodes from "../../../common/HttpStatusCodes";
import { RouteError } from "../../../common/classes";
import { AppRequest } from "../../../types/express";

// Create testimonial
/**
 * @swagger
 * /admin/testimonials/create:
 *   post:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Create testimonial
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Testimonial content
 *               authorName:
 *                 type: string
 *                 description: Author name
 *               authorTitle:
 *                 type: string
 *                 description: Author title
 *               rating:
 *                 type: number
 *                 description: Rating
 *     responses:
 *       201:
 *         description: Testimonial created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
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
/**
 * @swagger
 * /admin/testimonials/{testimonialId}/update:
 *   put:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Update testimonial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: testimonialId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               authorName:
 *                 type: string
 *               authorTitle:
 *                 type: string
 *               rating:
 *                 type: number
 *               isApproved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Testimonial updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Testimonial not found
 */
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
/**
 * @swagger
 * /admin/testimonials/{testimonialId}:
 *   get:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Get single testimonial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: testimonialId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Testimonial fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Testimonial not found
 */
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
/**
 * @swagger
 * /admin/testimonials:
 *   get:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Get all testimonials
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Testimonials fetched successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 */
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
/**
 * @swagger
 * /admin/testimonials/latestApproved:
 *   get:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Get latest approved testimonials
 *     security: []
 *     responses:
 *       200:
 *         description: Approved testimonials fetched successfully
 */
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
/**
 * @swagger
 * /admin/testimonials/{testimonialId}/delete:
 *   delete:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Delete testimonial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: testimonialId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Testimonial deleted successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Testimonial not found
 */
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
/**
 * @swagger
 * /admin/testimonials/{testimonialId}/updateStatus:
 *   put:
 *     tags:
 *       - Admin > Testimonials
 *     summary: Update testimonial status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: testimonialId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isApproved
 *             properties:
 *               isApproved:
 *                 type: boolean
 *                 description: Approval status
 *     responses:
 *       200:
 *         description: Testimonial status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Testimonial not found
 */
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
