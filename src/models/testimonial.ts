import { Schema, model, models, Document, Model } from 'mongoose';

export interface ITestimonial {
  fullName: string;
  occupation?: string;
  rating: number;
  message?: string;
  profileImage?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ITestimonialDoc extends ITestimonial, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type ITestimonialModel = Model<ITestimonialDoc>;

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

    this.TestimonialModel = models.Testimonial || model<ITestimonialDoc>('Testimonial', schema);
  }

  public get model(): ITestimonialModel {
    return this.TestimonialModel;
  }
}
