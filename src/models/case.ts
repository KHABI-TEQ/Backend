import { Schema, model, Document, Model, Types } from "mongoose";

export type CaseStatus =
  | "petition_submitted"
  | "case_opened"
  | "mediation"
  | "transferred_to_efcc"
  | "closed";

export type CaseClosureOutcome = "resolved" | "withdrawn" | "dismissed" | "referred_closed";

export interface ICaseMilestone {
  stage: CaseStatus;
  occurredAt: Date;
  by?: any;
}

export interface ICaseClosure {
  outcome: CaseClosureOutcome;
  summary: string;
  closedBy?: any;
}

export interface ICase {
  caseNumber: string;
  petitionId: any;
  registrationId: any;
  transactionReference: string;
  caseType: string;
  status: CaseStatus;
  assignedOfficer?: any;
  milestones: ICaseMilestone[];
  openedAt: Date;
  closedAt?: Date;
  closure?: ICaseClosure;
  lastActivityAt: Date;
}

export interface ICaseDoc extends ICase, Document {}
export type ICaseModel = Model<ICaseDoc>;

export class Case {
  private _model: ICaseModel;

  constructor() {
    const schema = new Schema<ICaseDoc>(
      {
        caseNumber: { type: String, required: true, unique: true, index: true },
        petitionId: { type: Schema.Types.ObjectId, ref: "Petition", required: true, index: true },
        registrationId: {
          type: Schema.Types.ObjectId,
          ref: "TransactionRegistration",
          required: true,
          index: true,
        },
        transactionReference: { type: String, required: true, index: true },
        caseType: { type: String, default: "transaction_dispute" },
        status: {
          type: String,
          enum: ["petition_submitted", "case_opened", "mediation", "transferred_to_efcc", "closed"],
          default: "case_opened",
          index: true,
        },
        assignedOfficer: { type: Schema.Types.ObjectId, ref: "Admin", required: false, index: true },
        milestones: [
          {
            stage: {
              type: String,
              enum: ["petition_submitted", "case_opened", "mediation", "transferred_to_efcc", "closed"],
              required: true,
            },
            occurredAt: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
          },
        ],
        openedAt: { type: Date, default: Date.now },
        closedAt: { type: Date, required: false },
        closure: {
          outcome: {
            type: String,
            enum: ["resolved", "withdrawn", "dismissed", "referred_closed"],
            required: false,
          },
          summary: { type: String, required: false },
          closedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: false },
        },
        lastActivityAt: { type: Date, default: Date.now, index: true },
      },
      { timestamps: true }
    );

    schema.index({ createdAt: -1 });

    this._model = model<ICaseDoc>("Case", schema);
  }

  public get model(): ICaseModel {
    return this._model;
  }
}
