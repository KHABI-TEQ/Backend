import { connect, connection, Connection } from "mongoose";
import {
  IAgentModel,
  Agent,
  IInspectionBookingModel,
  InspectionBooking,
  IAdminModel,
  Admin,
  IUserModel,
  User,
  IProperty,
  Property,
  IPropertyModel,
  Buyer,
  IBuyerModel,
  Preference,
  IPreferenceModel,
  IDocumentVerificationModel,
  DocumentVerification,
  IInspectionActivityLogModel,
  InspectionActivityLogModel,
  IBookingActivityLogModel,
  BookingActivityLogModel,
  INotificationModel,
  Notification,
  ContactUs,
  IContactUsModel,
  VerificationToken,
  PasswordResetToken,
  IMatchedPreferencePropertyModel,
  MatchedPreferenceProperty,
  PropertyView,
  IPropertyView,
  ITestimonialModel,
  Testimonial,
  IReferralLog,
  ReferralLogModel,
  IFieldAgentModel,
  FieldAgent,
  NewTransaction,
  INewTransactionModel,
  UserSubscriptionSnapshot,
  IUserSubscriptionSnapshotModel,
  SubscriptionPlan,
  ISubscriptionPlanModel,
  PlanFeature,
  IPlanFeatureModel,
  ISystemSettingModel,
  SystemSetting,
  PaymentMethod,
  IPaymentMethodModel,
  DealSite,
  IDealSiteModel,
  DealSiteReport,
  IDealSiteReportModel,
  DealSiteActivity,
  IDealSiteActivityModel,
  EmailSubscription,
  IEmailSubscriptionModel,
  Booking,
  IBookingModel,
  Promotion,
  IPromotionModel,
  PromotionActivity,
  IPromotionActivityModel,
  Permission,
  IPermissionModel,
  Role,
  IRoleModel,
} from "../models/index";


declare interface IModels {
  Agent: IAgentModel;
  InspectionActivityLog: IInspectionActivityLogModel;
  BookingActivityLog: IBookingActivityLogModel;
  InspectionBooking: IInspectionBookingModel;
  Admin: IAdminModel;
  User: IUserModel;
  Property: IPropertyModel;
  Buyer: IBuyerModel;
  Preference: IPreferenceModel;
  DocumentVerification: IDocumentVerificationModel;
  Notification: INotificationModel;
  ContactUs: IContactUsModel;
  VerificationToken: typeof VerificationToken;
  PasswordResetToken: typeof PasswordResetToken;
  MatchedPreferenceProperty: IMatchedPreferencePropertyModel;
  PropertyView: typeof PropertyView;
  ReferralLog: typeof ReferralLogModel;
  Testimonial: ITestimonialModel;
  FieldAgent: IFieldAgentModel;
  NewTransaction: INewTransactionModel;
  UserSubscriptionSnapshot: IUserSubscriptionSnapshotModel;
  SubscriptionPlan: ISubscriptionPlanModel;
  PlanFeature: IPlanFeatureModel;
  SystemSetting: ISystemSettingModel;
  PaymentMethod: IPaymentMethodModel;
  DealSite: IDealSiteModel;
  DealSiteReport: IDealSiteReportModel;
  DealSiteActivity: IDealSiteActivityModel;
  EmailSubscription: IEmailSubscriptionModel;
  Booking: IBookingModel;
  Promotion: IPromotionModel;
  PromotionActivity: IPromotionActivityModel;
  Permission: IPermissionModel;
  Role: IRoleModel;
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
      InspectionBooking: new InspectionBooking().model,
      Admin: new Admin().model,
      Testimonial: new Testimonial().model,
      User: new User().model,
      Property: new Property().model,
      Buyer: new Buyer().model,
      Preference: new Preference().model,
      DocumentVerification: new DocumentVerification().model,
      Notification: new Notification().model,
      ContactUs: new ContactUs().model,
      VerificationToken: VerificationToken,
      PasswordResetToken: PasswordResetToken,
      MatchedPreferenceProperty: MatchedPreferenceProperty,
      PropertyView: PropertyView,
      ReferralLog: ReferralLogModel,
      InspectionActivityLog: InspectionActivityLogModel,
      BookingActivityLog: BookingActivityLogModel,
      FieldAgent: new FieldAgent().model,
      NewTransaction: new NewTransaction().model,
      UserSubscriptionSnapshot: new UserSubscriptionSnapshot().model,
      SubscriptionPlan: new SubscriptionPlan().model,
      PlanFeature: new PlanFeature().model,
      SystemSetting: new SystemSetting().model,
      PaymentMethod: new PaymentMethod().model,
      DealSite: new DealSite().model,
      DealSiteReport: new DealSiteReport().model,
      DealSiteActivity: new DealSiteActivity().model,
      EmailSubscription: new EmailSubscription().model,
      Booking: new Booking().model,
      Promotion: new Promotion().model,
      PromotionActivity: new PromotionActivity().model,
      Permission: new Permission().model,
      Role: new Role().model,
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
