import mongoose from "mongoose";

/**
 * Resolve a lean() Mongoose ref: either a populated subdocument `{ _id, ... }` or a raw ObjectId / 24-char hex string.
 * Using `ref._id` alone breaks when the path was not populated (value is already an ObjectId).
 */
export function resolveLeanRefToObjectId(ref: unknown): mongoose.Types.ObjectId | null {
  if (ref == null) return null;
  if (ref instanceof mongoose.Types.ObjectId) return ref;
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    const inner = (ref as { _id: unknown })._id;
    if (inner instanceof mongoose.Types.ObjectId) return inner;
    if (typeof inner === "string" && mongoose.Types.ObjectId.isValid(inner)) {
      return new mongoose.Types.ObjectId(inner);
    }
  }
  if (typeof ref === "string" && mongoose.Types.ObjectId.isValid(ref)) {
    return new mongoose.Types.ObjectId(ref);
  }
  return null;
}
