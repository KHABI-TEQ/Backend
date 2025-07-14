import { Schema, model, models, Document, Model } from 'mongoose';

// 1. Interface
export interface ITestimonial {
  fullName: string;
  occupation?: string;
  rating: number;
  message?: string;
  profileImage?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// 2. Mongoose Document Type
export interface ITestimonialDoc extends ITestimonial, Document {}

// 3. Mongoose Model Type
export type ITestimonialModel = Model<ITestimonialDoc>;

// 4. Class
export class Testimonial {
  private TestimonialModel: ITestimonialModel;

  constructor() {
    const schema = new Schema<ITestimonialDoc>(
      {
        fullName: { type: String, required: true },
        occupation: { type: String },
        rating: { type: Number, required: true, min: 1, max: 5 },
        message: { type: String },
        profileImage: { type: String },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    );

    // ✅ Prevent OverwriteModelError
    this.TestimonialModel = models.Testimonial || model<ITestimonialDoc>('Testimonial', schema);
  }

  public get model(): ITestimonialModel {
    return this.TestimonialModel;
  }
}
