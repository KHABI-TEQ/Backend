import { Schema, model, Document, Model, Types } from "mongoose";

export interface ICaseMediationAttachment {
  fileName: string;
  url: string;
}

export interface ICaseMediationNote {
  caseId: Types.ObjectId;
  officer: Types.ObjectId;
  meetingNotes?: string;
  partyResponses?: string;
  proposedResolution?: string;
  outcome?: string;
  attachments: ICaseMediationAttachment[];
}

export interface ICaseMediationNoteDoc extends ICaseMediationNote, Document {}
export type ICaseMediationNoteModel = Model<ICaseMediationNoteDoc>;

export class CaseMediationNote {
  private _model: ICaseMediationNoteModel;

  constructor() {
    const schema = new Schema<ICaseMediationNoteDoc>(
      {
        caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
        officer: { type: Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
        meetingNotes: { type: String, required: false },
        partyResponses: { type: String, required: false },
        proposedResolution: { type: String, required: false },
        outcome: { type: String, required: false },
        attachments: [
          {
            fileName: { type: String, required: true },
            url: { type: String, required: true },
          },
        ],
      },
      { timestamps: true }
    );

    schema.index({ caseId: 1, createdAt: -1 });

    this._model = model<ICaseMediationNoteDoc>("CaseMediationNote", schema);
  }

  public get model(): ICaseMediationNoteModel {
    return this._model;
  }
}
