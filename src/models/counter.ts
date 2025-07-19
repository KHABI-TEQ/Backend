import { Schema, model } from 'mongoose';

const counterSchema = new Schema({
  model: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model('Counter', counterSchema);
