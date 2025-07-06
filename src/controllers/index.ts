import { connect, connection, Connection } from 'mongoose';
import {
  IPropertySellModel,
  IPropertyRentModel,
  PropertyRent,
  PropertySell,
  IAgentModel,
  Agent,
  IBuyerOrRent,
  BuyerOrRent,
  IBuyerOrRentModel,
  IPropertyRequestModel,
  PropertyRequest,
  IInspectionSlotModel,
  IInspectionBookingModel,
  InspectionSlot,
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
  BriefMatch,
  IBriefMatchModel,
  IDocumentVerificationModel,
  DocumentVerification,
  IInspectionActivityLogModel,
  InspectionActivityLogModel
} from '../models/index';
import { IOwnerModel, Owner } from '../models/property.owner';

declare interface IModels {
  PropertySell: IPropertySellModel;
  PropertyRent: IPropertyRentModel;
  Owner: IOwnerModel;
  Agent: IAgentModel;
  BuyerOrRent: IBuyerOrRentModel;
  PropertyRequest: IPropertyRequestModel;
  InspectionSlot: IInspectionSlotModel;
  InspectionActivityLog: IInspectionActivityLogModel;
  InspectionBooking: IInspectionBookingModel;
  Admin: IAdminModel;
  User: IUserModel;
  Property: IPropertyModel;
  Transaction: ITransactionModel;
  Buyer: IBuyerModel;
  Preference:IPreferenceModel;
  BriefMatch:IBriefMatchModel;
  DocumentVerification:IDocumentVerificationModel;
}

export class DB {
  private static instance: DB;

  private mongoDB: Connection;
  private models: IModels;

  constructor() {
    try {
      connect(process.env.MONGO_URL as string);
    } catch (err) {
      console.error(err, 'Error connecting to MongoDB');
    }
    this.mongoDB = connection;
    this.mongoDB.on('open', this.connected);
    this.mongoDB.on('error', this.error);

    this.models = {
      PropertyRent: new PropertyRent().model,
      PropertySell: new PropertySell().model,
      Owner: new Owner().model,
      Agent: new Agent().model,
      BuyerOrRent: new BuyerOrRent().model,
      PropertyRequest: new PropertyRequest().model,
      InspectionSlot: new InspectionSlot().model,
      InspectionActivityLog: InspectionActivityLogModel,
      InspectionBooking: new InspectionBooking().model,
      Admin: new Admin().model,
      User: new User().model,
      Property: new Property().model,
      Transaction: new Transaction().model,
      Buyer: new Buyer().model,
      Preference: new Preference().model,
      BriefMatch: new BriefMatch().model,
      DocumentVerification: new DocumentVerification().model,
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
    console.info('Mongoose has connected');
  }

  private error(error: Error) {
    console.info('Mongoose has errored', error);
  }
}

export { AgentController, IAgentController } from './Agent';
export { PropertyRentController, IPropertyRentController } from './Property.Rent';
export { PropertySellController, IPropertySellController } from './Property.Sell';
export { BuyerOrRentPropertyRentController, IBuyerOrRentPropertyRentController } from './Property.Rent.Request';

export { BuyerOrRentPropertySellController, IBuyerOrRentPropertySellController } from './Property.Sell.Request';
export { PropertyRequestController, IPropertRequestController } from './Property.Request';
