import { connect, connection, Connection } from "mongoose";
import {
  IInspectionBookingModel,
  IAgentModel,
  Agent,
  InspectionBooking,
  IAdminModel,
  Admin,
  IUserModel,
  User,
  IProperty,
  Property,
  IPropertyModel,
  ITransactionModel,
  Transaction,
  Buyer,
  IBuyerModel,
  Preference,
  IPreferenceModel,
  IDocumentVerificationModel,
  DocumentVerification,
  IInspectionActivityLogModel,
  InspectionActivityLogModel,
  INotificationModel,
  Notification,
  Testimonial,
  ITestimonialModel,
  ContactUs,
  IContactUsModel,
  VerificationToken,
  PasswordResetToken,
  IMatchedPreferencePropertyModel,
  MatchedPreferenceProperty,
  PropertyView,
  IPropertyView,
} from "../models/index";


declare interface IModels {
  Agent: IAgentModel;
  InspectionActivityLog: IInspectionActivityLogModel;
  InspectionBooking: IInspectionBookingModel;
  Admin: IAdminModel;
  User: IUserModel;
  Property: IPropertyModel;
  Transaction: ITransactionModel;
  Buyer: IBuyerModel;
  Preference: IPreferenceModel;
  DocumentVerification: IDocumentVerificationModel;
  Notification: INotificationModel;
  Testimonial: ITestimonialModel;
  ContactUs: IContactUsModel;
  VerificationToken: typeof VerificationToken;
  PasswordResetToken: typeof PasswordResetToken;
  MatchedPreferenceProperty: IMatchedPreferencePropertyModel;
  PropertyView: typeof PropertyView;
}

export class DB {
  private static instance: DB;

  private mongoDB: Connection;
  private models: IModels;

  constructor() {
    try {
      connect(process.env.MONGO_URL as string);
    } catch (err) {
      console.error(err, "Error connecting to MongoDB");
    }
    this.mongoDB = connection;
    this.mongoDB.on("open", this.connected);
    this.mongoDB.on("error", this.error);

    this.models = {
      Agent: new Agent().model,
      InspectionActivityLog: InspectionActivityLogModel,
      InspectionBooking: new InspectionBooking().model,
      Admin: new Admin().model,
      User: new User().model,
      Property: new Property().model,
      Transaction: new Transaction().model,
      Buyer: new Buyer().model,
      Preference: new Preference().model,
      DocumentVerification: new DocumentVerification().model,
      Notification: new Notification().model,
      Testimonial: new Testimonial().model,
      ContactUs: new ContactUs().model,
      VerificationToken: VerificationToken,
      PasswordResetToken: PasswordResetToken,
      MatchedPreferenceProperty: MatchedPreferenceProperty,
      PropertyView: PropertyView,
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public static get Models() {
    if (!DB.instance) {
      DB.instance = new DB();
    }
    return DB.instance.models;
  }

  private connected() {
    console.info("Mongoose has connected");
  }

  private error(error: Error) {
    console.info("Mongoose has errored", error);
  }
}
