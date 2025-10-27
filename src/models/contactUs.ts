import { Schema, model, models, Document, Model, Types } from "mongoose";

// 1. Interface
export interface IContactUs {
  name: string;
  phoneNumber?: string; // Optional, as some users might prefer email
  email: string;
  whatsAppNumber?: string;
  subject: string;
  message: string;
  status: "pending" | "replied" | "archived" | "spam"; // Status to manage inquiries
  receiverMode: {
    type?: "general" | "dealSite";
    dealSiteID?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
} 

// 2. Mongoose Document Type
export interface IContactUsDoc extends IContactUs, Document {}

// 3. Mongoose Model Type
export type IContactUsModel = Model<IContactUsDoc>;

// 4. Class
export class ContactUs {
  private ContactUsModel: IContactUsModel;

  constructor() {
    const schema = new Schema<IContactUsDoc>(
      {
        name: {
          type: String,
          required: [true, "Name is required"],
          trim: true, // Trim whitespace from the beginning and end of the string
          minlength: [2, "Name must be at least 2 characters long"],
          maxlength: [100, "Name cannot exceed 100 characters"],
        },
        phoneNumber: {
          type: String,
          // Optional: Add a regex for phone number validation if needed
          // match: /^\+?\d{1,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
          trim: true,
          maxlength: [20, "Phone number cannot exceed 20 characters"],
        },
        whatsAppNumber: {
          type: String,
          // Optional: Add a regex for phone number validation if needed
          // match: /^\+?\d{1,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
          trim: true,
          maxlength: [20, "Phone number cannot exceed 20 characters"],
        },
        email: {
          type: String,
          required: [true, "Email is required"],
          unique: false, // Not unique, as multiple people can contact
          trim: true,
          lowercase: true, // Store emails in lowercase
          match: [/.+@.+\..+/, "Please enter a valid email address"], // Basic email regex validation
        },
        subject: {
          type: String,
          required: [true, "Subject is required"],
          trim: true,
          minlength: [3, "Subject must be at least 3 characters long"],
          maxlength: [200, "Subject cannot exceed 200 characters"],
        },
        message: {
          type: String,
          required: [true, "Message is required"],
          trim: true,
          minlength: [10, "Message must be at least 10 characters long"],
          maxlength: [2000, "Message cannot exceed 2000 characters"],
        },
        status: {
          type: String,
          enum: ["pending", "replied", "archived", "spam"],
          default: "pending",
          required: true,
        },
        receiverMode: {
          type: {
            type: String,
            enum: ["general", "dealSite"],
            default: "general",
          },
          dealSiteID: { type: Schema.Types.ObjectId, ref: "DealSite" }
        },
      },
      {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
        toJSON: { virtuals: true }, // Include virtuals when converting to JSON
        toObject: { virtuals: true }, // Include virtuals when converting to Object
      },
    );

    // ✅ Prevent OverwriteModelError: This check prevents Mongoose from trying to recompile
    // a model if it has already been defined, which can happen in development environments
    // or when using hot-reloading.
    this.ContactUsModel =
      models.ContactUs || model<IContactUsDoc>("ContactUs", schema);
  }

  /**
   * Public getter to access the Mongoose ContactUs model.
   * @returns {IContactUsModel} The Mongoose model for ContactUs.
   */
  public get model(): IContactUsModel {
    return this.ContactUsModel;
  }
}
