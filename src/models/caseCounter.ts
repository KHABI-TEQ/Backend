import { Schema, model, Document, Model } from "mongoose";

export interface ICaseCounterDoc extends Document {
  _id: any;
  seq: number;
}
export type ICaseCounterModel = Model<ICaseCounterDoc>;

export class CaseCounter {
  private _model: ICaseCounterModel;

  constructor() {
    const schema = new Schema<ICaseCounterDoc>(
      {
        _id: { type: String, required: true },
        seq: { type: Number, default: 0 },
      },
      { timestamps: true }
    );

    this._model = model<ICaseCounterDoc>("CaseCounter", schema);
  }

  public get model(): ICaseCounterModel {
    return this._model;
  }
}
