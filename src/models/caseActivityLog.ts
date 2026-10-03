import { Schema, model, Document, Model, Types } from "mongoose";

export type CaseActivityActorType = "Admin" | "Buyer" | "System";

export type CaseActivityAction =
  | "PETITION_SUBMITTED"
  | "CASE_OPENED"
  | "OFFICER_ASSIGNED"
  | "STATUS_CHANGED"
  | "MEDIATION_NOTE_ADDED"
  | "INFORMATION_REQUESTED"
  | "BUYER_RESPONDED"
  | "EFCC_TRANSFER_ATTEMPTED"
  | "EFCC_TRANSFERRED"
  | "EFCC_TRANSFER_FAILED"
  | "CASE_CLOSED"
  | "CASE_RECORD_PDF_GENERATED";

export type CaseActivityVisibility = "internal" | "buyer";

export interface ICaseActivityLog {
  caseId: Types.ObjectId;
  registrationId: Types.ObjectId;
  actorType: CaseActivityActorType;
  actorId?: Types.ObjectId;
  actorLabel?: string;
  action: CaseActivityAction;
  visibility: CaseActivityVisibility;
  message: string;
  meta?: Record<string, unknown>;
}

export interface ICaseActivityLogDoc extends ICaseActivityLog, Document {}
export type ICaseActivityLogModel = Model<ICaseActivityLogDoc>;

export class CaseActivityLog {
  private _model: ICaseActivityLogModel;

  constructor() {
    const schema = new Schema<ICaseActivityLogDoc>(
      {
        caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
        registrationId: {
          type: Schema.Types.ObjectId,
          ref: "TransactionRegistration",
          required: true,
          index: true,
        },
        actorType: {
          type: String,
          enum: ["Admin", "Buyer", "System"],
          required: true,
        },
        actorId: { type: Schema.Types.ObjectId, required: false },
        actorLabel: { type: String, required: false },
        action: {
          type: String,
          enum: [
            "PETITION_SUBMITTED",
            "CASE_OPENED",
            "OFFICER_ASSIGNED",
            "STATUS_CHANGED",
            "MEDIATION_NOTE_ADDED",
            "INFORMATION_REQUESTED",
            "BUYER_RESPONDED",
            "EFCC_TRANSFER_ATTEMPTED",
            "EFCC_TRANSFERRED",
            "EFCC_TRANSFER_FAILED",
            "CASE_CLOSED",
            "CASE_RECORD_PDF_GENERATED",
          ],
          required: true,
        },
        visibility: {
          type: String,
          enum: ["internal", "buyer"],
          default: "internal",
          index: true,
        },
        message: { type: String, required: true },
        meta: { type: Schema.Types.Mixed, required: false },
      },
      { timestamps: true }
    );

    schema.index({ caseId: 1, createdAt: -1 });
    schema.index({ registrationId: 1, createdAt: -1 });

    this._model = model<ICaseActivityLogDoc>("CaseActivityLog", schema);
  }

  public get model(): ICaseActivityLogModel {
    return this._model;
  }
}
