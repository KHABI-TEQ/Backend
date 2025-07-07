import { Schema, model, Document } from 'mongoose';

export interface ITestimonial extends Document {
  fullName: string;
  occupation?: string;
  rating: number;
  message?: string;
  profileImage?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const TestimonialSchema = new Schema<ITestimonial>(
  {
    fullName: { type: String, required: true },
    occupation: { type: String, required: false },
    rating: { type: Number, min: 1, max: 5, required: true },
    message: { type: String, required: false },
    profileImage: { type: String, required: false },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export const TestimonialModel = model<ITestimonial>('Testimonial', TestimonialSchema);
