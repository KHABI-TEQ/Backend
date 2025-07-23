import { Response, NextFunction } from "express";
import { AppRequest } from "../../types/express";
import { DB } from "..";
import HttpStatusCodes from "../../common/HttpStatusCodes";
import { RouteError } from "../../common/classes";

/**
 * @desc Handles the submission of a contact form.
 * @route POST /api/contact
 * @access Public
 * @param {AppRequest} req - The Express request object, extended with AppRequest types.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export const submitContactForm = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Destructure required fields from the request body
    const {
      name,
      phoneNumber, // Optional field
      email,
      subject,
      message,
    } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Name, email, subject, and message are required fields.",
      });
    }

    // Create a new contact us entry in the database
    // The 'status' field will default to 'pending' as defined in the schema
    const newContactEntry = await DB.Models.ContactUs.create({
      name,
      phoneNumber,
      email,
      subject,
      message,
    });

    // Respond with success message and the created entry
    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      message: "Your message has been sent successfully!",
      data: newContactEntry,
    });
  } catch (err) {
    // Pass any errors to the next middleware (error handler)
    next(err);
  }
};

/**
 * @desc Fetches all contact form submissions.
 * @route GET /api/contact
 * @access Private (e.g., Admin only)
 * @param {AppRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export const getAllContactSubmissions = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // You might want to add pagination, filtering, and sorting here
    const submissions = await DB.Models.ContactUs.find({})
      .sort({ createdAt: -1 }) // Sort by most recent
      .lean(); // Return plain JavaScript objects

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Contact submissions fetched successfully",
      data: submissions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Fetches a single contact form submission by ID.
 * @route GET /api/contact/:id
 * @access Private (e.g., Admin only)
 * @param {AppRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export const getSingleContactSubmission = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const submission = await DB.Models.ContactUs.findById(id).lean();

    if (!submission) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Contact submission not found",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Contact submission fetched successfully",
      data: submission,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Updates the status of a contact form submission.
 * @route PUT /api/contact/:id/status
 * @access Private (e.g., Admin only)
 * @param {AppRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export const updateContactSubmissionStatus = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Submission ID and status are required",
      });
    }

    // Ensure the provided status is one of the allowed enum values
    const allowedStatuses = ["pending", "replied", "archived", "spam"];
    if (!allowedStatuses.includes(status)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Invalid status provided. Allowed statuses are: ${allowedStatuses.join(", ")}`,
      });
    }

    const updatedSubmission = await DB.Models.ContactUs.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }, // Return the updated document and run schema validators
    ).lean();

    if (!updatedSubmission) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Contact submission not found",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Contact submission status updated successfully",
      data: updatedSubmission,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Deletes a contact form submission.
 * @route DELETE /api/contact/:id
 * @access Private (e.g., Admin only)
 * @param {AppRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The Express next middleware function.
 */
export const deleteContactSubmission = async (
  req: AppRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const deletedSubmission =
      await DB.Models.ContactUs.findByIdAndDelete(id).lean();

    if (!deletedSubmission) {
      return next(
        new RouteError(
          HttpStatusCodes.NOT_FOUND,
          "Contact submission not found",
        ),
      );
    }

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      message: "Contact submission deleted successfully",
      data: deletedSubmission,
    });
  } catch (err) {
    next(err);
  }
};
