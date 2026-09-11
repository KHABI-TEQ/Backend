import { Schema, model, models, Document, Model, Types } from "mongoose";

export const CLIP_IMAGE_EMBEDDING_MODEL = "clip-vit-b-32";
export const CLIP_IMAGE_EMBEDDING_DIM = 512;
export const PROPERTY_IMAGE_VECTOR_INDEX_NAME = "property_image_embedding";

export interface IPropertyImageEmbedding {
  propertyId: Types.ObjectId;
  pictureUrl: string;
  embedding: number[];
  /** CLIP (or other) embedding model id. Named to avoid clashing with Mongoose Document.model. */
  embeddingModel: string;
}

export interface IPropertyImageEmbeddingDoc extends IPropertyImageEmbedding, Document {
  createdAt: Date;
  updatedAt: Date;
}

export type IPropertyImageEmbeddingModel = Model<IPropertyImageEmbeddingDoc>;

export class PropertyImageEmbedding {
  private propertyImageEmbeddingModel: IPropertyImageEmbeddingModel;

  constructor() {
    const schema = new Schema<IPropertyImageEmbeddingDoc>(
      {
        propertyId: {
          type: Schema.Types.ObjectId,
          ref: "Property",
          required: true,
          index: true,
        },
        pictureUrl: { type: String, required: true },
        embedding: { type: [Number], required: true },
        embeddingModel: {
          type: String,
          required: true,
          default: CLIP_IMAGE_EMBEDDING_MODEL,
        },
      },
      { timestamps: true },
    );

    schema.index({ propertyId: 1, pictureUrl: 1 }, { unique: true });

    this.propertyImageEmbeddingModel =
      models.PropertyImageEmbedding ||
      model<IPropertyImageEmbeddingDoc>("PropertyImageEmbedding", schema);
  }

  public get model(): IPropertyImageEmbeddingModel {
    return this.propertyImageEmbeddingModel;
  }
}
