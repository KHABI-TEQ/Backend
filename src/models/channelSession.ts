import { Schema, model, Document, Model } from "mongoose";

export type ChannelType = "ussd" | "whatsapp";

export type ChannelSessionStep =
  | "language_select"
  | "main"
  | "verify_agent_input"
  | "verify_agent_result"
  | "verify_property_input"
  | "verify_property_result"
  | "fee_info"
  | "pay_fee_select"
  | "pay_fee_pending"
  | "awaiting_human";

export interface IChannelSession {
  channel: ChannelType;
  sessionId: string;
  phoneNumber: string;
  step: ChannelSessionStep;
  language?: string;
  context?: Record<string, unknown>;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IChannelSessionDoc extends IChannelSession, Document {}
export type IChannelSessionModel = Model<IChannelSessionDoc>;

const STEP_ENUM: ChannelSessionStep[] = [
  "language_select",
  "main",
  "verify_agent_input",
  "verify_agent_result",
  "verify_property_input",
  "verify_property_result",
  "fee_info",
  "pay_fee_select",
  "pay_fee_pending",
  "awaiting_human",
];

export class ChannelSession {
  private _model: IChannelSessionModel;

  constructor() {
    const schema = new Schema<IChannelSessionDoc>(
      {
        channel: { type: String, enum: ["ussd", "whatsapp"], required: true, index: true },
        sessionId: { type: String, required: true, index: true },
        phoneNumber: { type: String, required: true, index: true },
        step: { type: String, enum: STEP_ENUM, default: "main" },
        language: { type: String, default: "en" },
        context: { type: Schema.Types.Mixed, default: {} },
        expiresAt: { type: Date, required: true, index: true },
      },
      { timestamps: true }
    );

    schema.index({ channel: 1, sessionId: 1 }, { unique: true });
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    this._model = model<IChannelSessionDoc>("ChannelSession", schema);
  }

  public get model(): IChannelSessionModel {
    return this._model;
  }
}
