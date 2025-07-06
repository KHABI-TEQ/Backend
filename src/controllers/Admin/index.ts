import {
  accountApproved,
  accountDisaapproved,
  accountUpgradeApprovedTemplate,
  accountUpgradeDisapprovedTemplate,
  DeactivateOrActivateAgent,
  DeleteAgent,
  generalTemplate,
  generatePropertyBriefEmail,
  PropertyApprovedOrDisapprovedTemplate,
  preferenceMatchingTemplate,
} from '../../common/email.template'; 
import { DB } from '..';
import mongoose, { Types } from "mongoose"
import { AgentController } from '../Agent';
import { PropertyRentController } from '../Property.Rent';
import { BuyerOrRentPropertyRentController } from '../Property.Rent.Request';
import { PropertyRequestController } from '../Property.Request';
import { PropertySellController } from '../Property.Sell';
import { BuyerOrRentPropertySellController } from '../Property.Sell.Request';
import sendEmail from '../../common/send.email';
import { RouteError, signJwt, signJwtAdmin } from '../../common/classes';
import HttpStatusCodes from '../../common/HttpStatusCodes';
import bcrypt from 'bcryptjs';
import { PropertyProps } from '../Property';
import { IAgentDoc, IBriefMatchModel, IPreference, IProperty, IUserDoc } from '../../models';
import { relativeTimeThreshold } from 'moment/ts3.1-typings/moment';
import { Model } from 'mongoose';
import { formatAgentDataForTable, formatLandOwnerDataForTable, formatUpgradeAgentForTable } from '../../utils/userFormatters';
import { formatPropertyDataForTable } from '../../utils/propertyFormatters';


export class AdminController {
  private agentController = new AgentController();
  private propertySellController = new PropertySellController();
  private propertyRentController = new PropertyRentController();
  private propertyRentRequestController = new PropertyRequestController();
  private buyerOrRentePropertyController = new BuyerOrRentPropertyRentController();
  private buyerOrRenterPropertySellController = new BuyerOrRentPropertySellController();
  private readonly ownerTypes = ['PropertyOwner', 'BuyerOrRenter', 'Agent'];

  private readonly defaultPassword = 'KhabiTeqRealty@123';

  //==================================

  public async getAllProperties(filters?: {
    ownerType?: 'Landowners' | 'Agent' | 'All';
    isPremium?: string;
    isApproved?: string;
    isRejected?: string;
    isAvailable?: string;
    briefType?: string[];
    location?: string;
    propertyType?: string;
    priceMin?: string;
    priceMax?: string;
    isPreference?: string;
    buildingType?: string[];
    page?: string;
    limit?: string;
  }) {
    const matchStage: any = {};

    // User type (owner)
    if (filters?.ownerType && filters.ownerType !== 'All') {
      matchStage['owner.userType'] = filters.ownerType;
    }

    // Boolean filters
    if (filters?.isPremium !== undefined) matchStage.isPremium = filters.isPremium === 'true';
    if (filters?.isApproved !== undefined) matchStage.isApproved = filters.isApproved === 'true';
    if (filters?.isRejected !== undefined) matchStage.isRejected = filters.isRejected === 'true';
    if (filters?.isAvailable !== undefined) matchStage.isAvailable = filters.isAvailable;
    if (filters?.isPreference !== undefined) matchStage.isPreference = filters.isPreference === 'true';

    // Exact match
    if (filters?.propertyType) matchStage.propertyType = filters.propertyType;

    // briefType array
    if (filters?.briefType?.length) {
      matchStage.briefType = { $in: filters.briefType };
    }

    // buildingType array
    if (filters?.buildingType?.length) {
      matchStage.buildingType = { $in: filters.buildingType };
    }

    // location: check in multiple fields using $or
    if (filters?.location) {
      const regex = new RegExp(filters.location, 'i');
      matchStage.$or = [
        { 'location.state': regex },
        { 'location.localGovernment': regex },
        { 'location.area': regex },
      ];
    }

    // Price Range
    if (filters?.priceMin || filters?.priceMax) {
      matchStage.price = {};
      if (filters.priceMin) matchStage.price.$gte = Number(filters.priceMin);
      if (filters.priceMax) matchStage.price.$lte = Number(filters.priceMax);
    }

    const page = parseInt(filters?.page || '1');
    const limit = parseInt(filters?.limit || '10');
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: '$owner' },
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const result = await DB.Models.Property.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    };
  }

  public async createAdmin(adminCred: {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    address: string;
    password?: string; // optional password
  }) {
    try {
      const { email, firstName, lastName, phoneNumber, address, password } = adminCred;

      const normalizedEmail = email.toLowerCase().trim();

      const existingAdmin = await DB.Models.Admin.findOne({ email: normalizedEmail }).exec();
      if (existingAdmin) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Admin with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(password || this.defaultPassword, 10);

      const newAdmin = new DB.Models.Admin({
        email: normalizedEmail,
        firstName,
        lastName,
        phoneNumber,
        address,
        password: hashedPassword,
      });

      await newAdmin.save();

      return {
        message: 'Admin created successfully',
        admin: newAdmin.toObject(),
      };
    } catch (error: any) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Failed to create admin');
    }
  }

  public async getAdmins(params: {
    page?: number;
    limit?: number;
    search?: string;
    filters?: Record<string, any>;
  }) {
    const { page = 1, limit = 10, search = '', filters = {} } = params;
    const skip = (page - 1) * limit;

    const query: any = {};

    // 🔍 Search by name, email, or phone
    if (search.trim()) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // ✅ Apply filters
    if (filters.role) query.role = filters.role;
    if (filters.isAccountVerified !== undefined) {
      query.isAccountVerified = filters.isAccountVerified === 'true';
    }
    if (filters.isAccountInRecovery !== undefined) {
      query.isAccountInRecovery = filters.isAccountInRecovery === 'true';
    }

    const total = await DB.Models.Admin.countDocuments(query);
    const admins = await DB.Models.Admin.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return { admins, pagination };
  }

  public async deleteAdmin(adminId: string) {
    const deleted = await DB.Models.Admin.findByIdAndDelete(adminId);
    if (!deleted) {
      throw new RouteError(404, 'Admin account not found or already deleted.');
    }
    return { message: 'Admin account deleted successfully.' };
  }

  public async changePassword(adminId: string, newPassword: string) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const admin = await DB.Models.Admin.findByIdAndUpdate(adminId, {
        password: hashedPassword,
        isVerifed: true,
      }).exec();
      if (!admin) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Admin not found');

      return { message: 'Password changed successfully' };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getUsersByType(params: {
    userType: 'Agent' | 'Landowners';
    page: number;
    limit: number;
    search?: string;
    filters?: Record<string, any>;
  }) {
    const { userType, page = 1, limit = 10, search = '', filters = {} } = params;

    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const query: any = {};
    const searchConditions: any[] = [];

    if (search.trim()) {
      searchConditions.push(
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      );
    }

    if (searchConditions.length > 0) {
      query.$or = searchConditions;
    }

    if (filters?.accountStatus && filters.accountStatus !== 'null') {
      query.accountStatus = filters.accountStatus;
    }

    if (filters?.isFlagged !== undefined && filters.isFlagged !== 'null') {
      query.isFlagged = filters.isFlagged === 'true';
    }

    if (filters?.accountApproved !== undefined && filters.accountApproved !== 'null') {
      query.accountApproved = filters.accountApproved === 'true';
    }

    if (filters?.excludeInactive !== false) {
      query.isInActive = false;
    }

    // ✅ Format Agent Results
    if (userType === 'Agent') {
      const AgentModel: Model<IAgentDoc> = DB.Models.Agent;

      const total = await AgentModel.countDocuments(query);

      const agents = await AgentModel.find(query)
        .populate({
          path: 'userId',
          select:
            'email firstName lastName phoneNumber profile_picture userType isAccountVerified accountStatus accountApproved isInActive isDeleted isFlagged',
        })
        .skip(skip)
        .limit(safeLimit)
        .sort({ createdAt: -1 })
        .lean();

      const formattedAgents = agents.map(formatAgentDataForTable);

      return {
        users: formattedAgents,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    }

    // ✅ Format Landowner Results
    const UserModel: Model<IUserDoc> = DB.Models.User;
    query.userType = 'Landowners';

    const total = await UserModel.countDocuments(query);

    const users = await UserModel.find(query)
      .skip(skip)
      .limit(safeLimit)
      .sort({ createdAt: -1 })
      .lean();

    const formattedLandowners = users.map(formatLandOwnerDataForTable);

    return {
      users: formattedLandowners,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  public async getAgentProfile(userId: string) {
    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== 'Agent') throw new Error('Agent not found');

    const agentData = await DB.Models.Agent.findOne({ userId }).lean();
    const properties = await DB.Models.Property.find({ owner:user._id }).lean();
    const transactions = await DB.Models.Transaction.find({ buyerId:user._id }).lean();
    const inspections = await DB.Models.InspectionBooking.find({ bookedBy:user._id }).lean();

    // Financial summary
    const totalSpent = 0;
    // const totalSpent = transactions.reduce((sum, t) => sum + (t?.amount || 0), 0);
    const completedInspections = inspections.filter(i => i.status === 'completed');

    return {
      user,
      agentData,
      properties,
      transactions,
      inspections,
      stats: {
        totalProperties: properties.length,
        totalTransactions: transactions.length,
        totalSpent,
        completedInspections: completedInspections.length,
        ongoingNegotiations: inspections.filter(i => i.stage === 'negotiation').length,
      },
    };
  }

  public async getLandownerProfile(userId: string) {
    const user = await DB.Models.User.findById(userId).lean();
    if (!user || user.userType !== 'Landowners') throw new Error('Landowner not found');

    const properties = await DB.Models.Property.find({ owner: user._id }).lean();
    const propertyIds = properties.map(p => p._id);

    const inspections = await DB.Models.InspectionBooking.find({ propertyId: { $in: propertyIds } }).lean();
    const transactions = await DB.Models.Transaction.find({ propertyId: { $in: propertyIds } }).lean();

    const totalEarned = 0;
    // const totalEarned = transactions.reduce((sum, t) => sum + (t?.amount || 0), 0);
    const completedInspections = inspections.filter(i => i.status === 'completed');

    return {
      user,
      properties,
      transactions,
      inspections,
      stats: {
        totalProperties: properties.length,
        totalTransactions: transactions.length,
        totalEarned,
        completedInspections: completedInspections.length,
        pendingNegotiations: inspections.filter(i => i.stage === 'negotiation').length,
      },
    };
  }

  public async getAllUpgradeRequests(
    page: number,
    limit: number
  ): Promise<{
    data: any[];
    total: number;
    currentPage: number;
  }> {
    try {
      const query = { isInUpgrade: true };

      const agents = await DB.Models.Agent.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ 'upgradeData.requestDate': -1 })
        .populate('userId', 'email firstName lastName phoneNumber fullName isAccountVerified accountStatus isFlagged')
        .exec();

      const total = await DB.Models.Agent.countDocuments(query);

      const formattedData = agents.map(formatUpgradeAgentForTable);

      return {
        data: formattedData,
        total,
        currentPage: page,
      };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async approveAgentOnboarding(_id: string, approved: boolean) {
    try {
      // 1. Update the user’s approval status
      const userAcct = await DB.Models.User.findByIdAndUpdate(
        _id,
        { accountApproved: approved },
        { new: true }
      ).exec();

      if (!userAcct) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');
      }

      // 2. Update the corresponding agent’s approval status
      await DB.Models.Agent.findOneAndUpdate(
        { userId: userAcct._id },
        { accountApproved: approved },
        { new: true }
      ).exec();

      // 3. Compose the email
      const subject = approved
        ? 'Welcome to KhabiTeqRealty – Your Partnership Opportunity Awaits!'
        : 'Update on Your KhabiTeqRealty Application';

      const emailBody = generalTemplate(
        approved
          ? accountApproved(userAcct.firstName)
          : accountDisaapproved(userAcct.firstName)
      );

      // 4. Send the email
      await sendEmail({
        to: userAcct.email,
        subject,
        text: emailBody,
        html: emailBody,
      });

      return approved ? 'Agent onboarding approved successfully' : 'Agent onboarding rejected successfully';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async flagOrUnflagAgent(agentId: string, status: boolean) {
    try {
      const isFlagged = status;

      const agent = await DB.Models.Agent.findByIdAndUpdate(
        agentId,
        { isFlagged },
        { new: true }
      ).exec();

      if (!agent) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');
      }

      // Optional: Also update the associated User's isFlagged field
      await DB.Models.User.findByIdAndUpdate(agent.userId, { isFlagged }).exec();

      return isFlagged
        ? 'Agent flagged successfully'
        : 'Agent unflagged successfully';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  };

  public async flagOrUnflagLandowner(userId: string, status: boolean) {
    try {
      const isFlagged = status;

      const user = await DB.Models.User.findOneAndUpdate(
        { _id: userId, userType: 'Landowners' },
        { isFlagged },
        { new: true }
      ).exec();

      if (!user) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Landowner not found');
      }

      return isFlagged
        ? 'Landowner flagged successfully'
        : 'Landowner unflagged successfully';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getPropertiesByUser(userId: string, page: number = 1, limit: number = 10) {
    const user = await DB.Models.User.findById(userId).lean();
    if (!user || !['Agent', 'Landowners'].includes(user.userType)) {
      throw new Error('User not found or not eligible');
    }

    const query = { owner: userId };

    const properties = await DB.Models.PropertySell.find(query)
      .populate('owner', 'email firstName lastName fullName phoneNumber userType')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await DB.Models.PropertySell.countDocuments(query);

    return {
      data: properties.map(formatPropertyDataForTable),
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        perPage: limit,
      },
    };
  }

  public async getPropertyStats() {
    const Property = DB.Models.Property;

    // Explicitly typing 'owner' as a User object in population
    const allProperties = await Property.find()
      .populate('owner', 'userType')
      .lean()
      .exec();

    const totalProperties = allProperties.length;

    const agentProperties = allProperties.filter(
      (p: any) => p.owner && (p.owner as any).userType === 'Agent'
    );

    const landownerProperties = allProperties.filter(
      (p: any) => p.owner && (p.owner as any).userType === 'Landowners'
    );

    const activeProperties = allProperties.filter(p => p.isAvailable === 'yes');
    const inactiveProperties = allProperties.filter(p => p.isAvailable !== 'yes');

    const sum = (arr: typeof allProperties) => arr.reduce((total, p) => total + (p.price || 0), 0);

    return {
      totalProperties,
      totalAgentProperties: agentProperties.length,
      totalLandownerProperties: landownerProperties.length,
      totalActiveProperties: activeProperties.length,
      totalInactiveProperties: inactiveProperties.length,
      sumOfActivePropertyPrices: sum(activeProperties),
      sumOfInactivePropertyPrices: sum(inactiveProperties),
      sumOfAllPropertyPrices: sum(allProperties),
    };
  }

























  




  public async randomlyAssignBuyersToPreferences() {
  try {
    // Fetch all buyer IDs
    const buyers = await DB.Models.Buyer.find({}, '_id').lean().exec();
    if (!buyers.length) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'No buyers found');
    }

    // Fetch all preferences where buyer is null
    const preferences = await DB.Models.Preference.find().exec();

    if (!preferences.length) {
      return {
        message: 'No preferences to update',
        updatedCount: 0,
      };
    }

    // Randomly assign buyers
    const updates = preferences.map((pref) => {
      const randomBuyer:any = buyers[Math.floor(Math.random() * buyers.length)];
      return {
        updateOne: {
          filter: { _id: pref._id },
          update: { buyer: new mongoose.Types.ObjectId(randomBuyer._id) },
        },
      };
    });

    // Perform bulk write
    const result = await DB.Models.Preference.bulkWrite(updates);

    return {
      message: 'Buyers assigned successfully to preferences',
      updatedCount: result.modifiedCount || 0,
    };
  } catch (error) {
    console.error(error);
    throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
}


  // =================================

  public async getAllUsers(params: {
    page: number;
    limit: number;
    filters?: any;
    search?: string;
  }) {
    const { page = 1, limit = 10, filters = {}, search = '' } = params;

    const query: any = {};

    // 🔍 Optional filters
    if (filters?.email) query.email = { $regex: filters.email, $options: 'i' };
    if (filters?.role) query.role = filters.role;
    if (filters?.status) query.status = filters.status;

    // 🔎 Optional search on multiple fields
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await DB.Models.User.countDocuments(query);

    const usersRaw = await DB.Models.User.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    const users = await Promise.all(
      usersRaw.map(async (user) => {
        const agentData = await DB.Models.Agent.findOne({ userId: user._id }).exec();
        return {
          ...user.toObject(),
          agentData,
        };
      })
    );

    return {
      page,
      limit,
      total,
      users,
    };
  }
 

  


  


  public async groupPropsWithOwner(
    ownerModel: 'PropertySell' | 'PropertyRent',
    ownerType: string,
    page?: number,
    limit?: number
  ) {
    const groupedProperties = await DB.Models[ownerModel].aggregate([
      {
        $lookup: {
          from: ownerType, // or 'agents', 'buyerorrenters', depending on ownerModel
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerDetails',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                fullName: 1,
                phoneNumber: 1,
                agentType: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: '$ownerDetails',
      },
      {
        $group: {
          _id: '$owner',
          ownerInfo: { $first: '$ownerDetails' },
          properties: { $push: '$$ROOT' },
        },
      },
      { $sort: { 'properties.0.createdAt': -1 } },

      // Pagination
      { $skip: (page - 1) * limit },
      { $limit: limit },

      {
        $project: {
          _id: 0,
          ownerId: '$_id',
          ownerInfo: 1,
          properties: {
            $map: {
              input: '$properties',
              as: 'property',
              in: {
                _id: '$$property._id',
                propertyType: '$$property.propertyType',
                location: '$$property.location',
                price: '$$property.price',
                docOnProperty: '$$property.docOnProperty',
                propertyFeatures: '$$property.propertyFeatures',
                owner: '$$property.owner',
                ownerModel: '$$property.ownerModel',
                areYouTheOwner: '$$property.areYouTheOwner',
                usageOptions: '$$property.usageOptions',
                isAvailable: '$$property.isAvailable',
                budgetRange: '$$property.budgetRange',
                pictures: '$$property.pictures',
                isApproved: '$$property.isApproved',
                isRejected: '$$property.isRejected',
                landSize: '$$property.landSize',
                tenantCriteria: '$$property.tenantCriteria',
                noOfBedrooms: '$$property.noOfBedrooms',
                createdAt: '$$property.createdAt',
                updatedAt: '$$property.updatedAt',
              },
            },
          },
        },
      },
    ]);

    return groupedProperties;
  }

  public async getAllPropertiesWithOwnersGrouped(userType: string, page: number, limit: number) {
    // if (!this.ownerTypes.includes(ownerType)) {
    //   throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    // }
    if (userType === 'seller') {
      return await this.groupPropsWithOwner('PropertySell', 'propertyowners', page, limit);
    } else if (userType === 'landlord') {
      return await this.groupPropsWithOwner('PropertyRent', 'propertyowners', page, limit);
    } else if (userType === 'buyer') {
      const rentPrefencees = await this.groupPropsWithOwner('PropertyRent', 'BuyerOrRenter', page, limit);
      const sellPreferences = await this.groupPropsWithOwner('PropertySell', 'BuyerOrRenter', page, limit);

      return { rentPrefencees, sellPreferences };
    } else if (userType === 'agent') {
      return await this.groupPropsWithOwner('PropertySell', 'agents', page, limit);
    } else {
      return [];
    }
  }

  public async getProperties(briefType: string, ownerType: string, page: number, limit: number) {
    if (ownerType === 'all') {
      if (briefType === 'all') {
        const properties = await DB.Models.Property.find({})
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      } else {
        const properties = await DB.Models.Property.find({ briefType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      }
    } else {
      if (briefType === 'all') {
        const properties = await DB.Models.Property.find({ ownerType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ ownerType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      } else {
        const properties = await DB.Models.Property.find({ briefType, ownerType })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('owner', 'email firstName lastName phoneNumber fullName')
          .sort({ createdAt: -1 })
          .exec();

        const total = await DB.Models.Property.countDocuments({ briefType, ownerType }).exec();
        return {
          data: properties,
          total,
          currentPage: page,
        };
      }
    }
    // if (!this.ownerTypes.includes(ownerType)) {
    //   throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    // }

    // if (propertyType === 'rent') {
    //   if (ownerType === 'BuyerOrRenter') {
    //     return await this.buyerOrRentePropertyController.all(page, limit);
    //   } else {
    //     return await this.propertyRentController.all(page, limit, ownerType);
    //   }
    // } else if (propertyType === 'all') {
    //   if (ownerType === 'BuyerOrRenter') {
    //     const propertyRentPreference = await this.buyerOrRentePropertyController.all(page, limit);
    //     const propertySellPreference = await this.buyerOrRenterPropertySellController.all(page, limit);

    //     return {
    //       data: {
    //         rents: propertyRentPreference.data,
    //         sells: propertySellPreference.data,
    //         success: true,
    //         message: 'Properties fetched successfully',
    //       },
    //     };
    //   }
    //   const propertyRent = await this.propertyRentController.all(page, limit, 'all');
    //   const propertySell = await this.propertySellController.all(page, limit, 'all');
    //   return {
    //     data: {
    //       rents: propertyRent.data,
    //       sells: propertySell.data,
    //       success: true,
    //       message: 'Properties fetched successfully',
    //     },
    //   };
    // } else {
    //   if (ownerType === 'BuyerOrRenter') {
    //     return await this.buyerOrRenterPropertySellController.all(page, limit);
    //   } else {
    //     return await this.propertySellController.all(page, limit, ownerType);
    //   }
    // }
  }

  public async deleteProperty(propertyType: string, _id: string, ownerType: string) {
    if (!this.ownerTypes.includes(ownerType)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid owner type');
    }

    if (propertyType === 'rent') {
      if (ownerType === 'BuyerOrRenter') {
        await this.buyerOrRentePropertyController.delete(_id);
      } else {
        await this.propertyRentController.delete(_id, ownerType);
      }
    } else {
      if (ownerType === 'BuyerOrRenter') {
        await this.buyerOrRenterPropertySellController.delete(_id);
      } else {
        await this.propertySellController.delete(_id, ownerType);
      }
    }
  }

  //   public async deletePropertyRequest(propertyType: string, _id: string) {
  //     if (propertyType === 'rent') {
  //       await this.propertyRentRequestController.delete(_id);
  //     } else {
  //       await this.propertyRequestController.delete(_id);
  //     }
  //   }

  public async deletePropByBuyerOrRenter(propertyType: string, _id: string) {
    if (propertyType === 'rent') {
      await this.buyerOrRentePropertyController.delete(_id);
    } else {
      await this.buyerOrRenterPropertySellController.delete(_id);
    }
  }

  public async approveOrDisapproveProperty(_id: string, status: boolean) {
    let property, owner;
    property = await DB.Models.Property.updateOne({ _id }, { isApproved: status }).exec();

    if (!property) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Property not found');

    property = await DB.Models.Property.findById(_id).populate('owner').exec();

    const mailBody = generalTemplate(
      PropertyApprovedOrDisapprovedTemplate(
        ((property?.owner as any).fullName as any) || (property?.owner as any).firstName,
        status ? 'approved' : 'disapproved',
        property
      )
    );

    await sendEmail({
      to: (property?.owner as any).email,
      subject: 'Property Approval Status',
      html: mailBody,
      text: mailBody,
    });

    return status ? 'Property approved' : 'Property disapproved';
  }

  public async deactivateAgent(_id: string, inActiveSatatus: boolean, reason: string) {
    try {
      const agent = await DB.Models.User.findByIdAndUpdate(_id, {
        isInActive: inActiveSatatus,
        accountApproved: inActiveSatatus,
      }).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const properties = await DB.Models.Property.find({ owner: agent._id }).exec();

      properties.length > 0 &&
        properties.forEach(async (property) => {
          await DB.Models.PropertyRent.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
        });

      // sellProperties.forEach(async (property) => {
      //   await DB.Models.PropertySell.findByIdAndUpdate(property._id, { isApproved: inActiveSatatus }).exec();
      // });

      const mailBody = generalTemplate(
        DeactivateOrActivateAgent(agent.firstName || agent.lastName || agent.email, inActiveSatatus, reason)
      );

      await sendEmail({
        to: agent.email,
        subject: inActiveSatatus ? 'Account Deactivated' : 'Account Activated',
        text: mailBody,
        html: mailBody,
      });

      return inActiveSatatus ? 'Agent deactivated' : 'Agent activated';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async deleteAgent(_id: string, reason: string) {
    try {
      const agent = await DB.Models.User.findByIdAndDelete(_id).exec();

      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      // const rentProperties = await DB.Models.PropertyRent.find({ owner: agent._id }).exec();
      // const sellProperties = await DB.Models.PropertySell.find({ owner: agent._id }).exec();

      // rentProperties.forEach(async (property) => {
      //   await DB.Models.PropertyRent.findByIdAndDelete(property._id).exec();
      // });

      // sellProperties.forEach(async (property) => {
      //   await DB.Models.PropertySell.findByIdAndDelete(property._id).exec();
      // });
      await DB.Models.Agent.findOneAndDelete({ userId: agent._id }).exec();

      const mailBody = generalTemplate(DeleteAgent(agent.firstName, reason));

      await sendEmail({
        to: agent.email,
        subject: 'Account Deleted',
        text: mailBody,
        html: mailBody,
      });

      return 'Agent deleted';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  


  public async getAgents(page: number, limit: number, type: string, userType: string, approved?: string) {
    const isApproved = approved === 'true' ? true : approved === 'false' ? false : undefined;
 
    // Stats
    const totalActiveAgents = await DB.Models.User.countDocuments({
      isInActive: false,
      accountApproved: true,
      userType,
    });

    const totalInactiveAgents = await DB.Models.User.countDocuments({
      isInActive: true,
      accountApproved: true,
      userType,
    });

    const totalFlaggedAgents = await DB.Models.User.countDocuments({
      isFlagged: true,
      accountApproved: true,
      userType,
    });

    const totalAgents = await DB.Models.User.countDocuments({ userType }).exec();

    // Filters
    const filter: any = { userType };
    if (isApproved !== undefined) {
      filter.accountApproved = isApproved;
    }

    switch (type) {
      case 'active':
        filter.isInActive = false;
        break;
      case 'inactive':
        filter.isInActive = true;
        break;
      case 'flagged':
        filter.isFlagged = true;
        break;
      case 'all':
        // allow `accountApproved = false` if explicitly passed
        break;
      case 'onboarding':
        const onboarding = await DB.Models.Agent.find({
          agentType: { $nin: ['Individual', 'Company'] },
        })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'email firstName lastName phoneNumber fullName')
          .exec();

        return {
          data: onboarding,
          totalActiveAgents,
          totalInactiveAgents,
          totalFlaggedAgents,
          totalAgents,
          currentPage: page,
        };
      default:
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid agent type');
    }

    const agents = await DB.Models.User.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      data: agents,
      totalActiveAgents,
      totalInactiveAgents,
      totalFlaggedAgents,
      totalAgents,
      currentPage: page,
    };
  }

  




  public async approveUpgradeRequest(_id: string, approved: boolean) {
    try {
      const user = await DB.Models.User.findById(_id).exec();
      if (!user) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const agent = await DB.Models.Agent.findOne({ userId: user._id }).exec();
      if (!agent) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Agent not found');

      const updateData = approved
        ? {
            isInUpgrade: false,
            upgradeData: {
              companyAgent: agent.upgradeData.companyAgent,
              meansOfId: agent.upgradeData.meansOfId,
              requestDate: agent.upgradeData.requestDate,
              approvedDate: new Date(),
            },
            individualAgent: {
              typeOfId: '',
            },
            companyAgent: agent.upgradeData.companyAgent,
            meansOfId: agent.upgradeData.meansOfId,
          }
        : {
            isInUpgrade: false,
          };

      await DB.Models.Agent.findByIdAndUpdate(_id, updateData).exec();

      const body = approved
        ? accountUpgradeApprovedTemplate(user.firstName)
        : accountUpgradeDisapprovedTemplate(user.firstName);
      const mailBody = generalTemplate(body);

      await sendEmail({
        to: user.email,
        subject: 'Update on Your KhabiTeqRealty Application',
        text: mailBody,
        html: mailBody,
      });

      return approved ? 'Agent upgrade approved' : 'Agent upgrade disapproved';
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async add(Property: PropertyProps): Promise<IProperty> {
    try {
      const owner = await DB.Models.User.findOne({ email: Property.owner.email });

      if (!owner) {
        throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Owner not found');
      }

      const newProperty = await DB.Models.Property.create({
        ...Property,
        owner: owner._id,
        isApproved: true,
      });
      const mailBody = generatePropertyBriefEmail(Property.owner.fullName, Property);

      const generalMailTemplate = generalTemplate(mailBody);

      const adminEmail = process.env.ADMIN_EMAIL || '';

      await sendEmail({
        to: owner.email,
        subject: 'New Property',
        text: generalMailTemplate,
        html: generalMailTemplate,
      });
      // const mailBody1 = generalTemplate(generatePropertySellBriefEmail({ ...Property, isAdmin: true }));

      // await sendEmail({
      //   to: adminEmail,
      //   subject: 'New Property',
      //   text: mailBody1,
      //   html: mailBody1,
      // });

      return newProperty;
    } catch (err) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, err.message);
    }
  }

  public async getPropertyRequests(propertyType: 'PropertySell' | 'PropertyRent', page: number, limit: number) {
    const requests = await DB.Models.PropertyRequest.find({ propertyModel: propertyType })
      .populate('requestFrom')
      .populate({
        path: 'propertyId',
        populate: {
          path: 'owner',
          select: 'email firstName lastName phoneNumber fullName',
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec()
      .then((requests) => {
        return requests.map((request) => {
          const { propertyId, requestFrom, ...otherRequestDetails } = request.toObject();
          return {
            ...otherRequestDetails,
            property: propertyId,
            buyer: requestFrom,
          };
        });
      });

    const total = await DB.Models.PropertyRequest.countDocuments({ propertyModel: propertyType }).exec();
    return {
      data: requests,
      total,
      currentPage: page,
    };
  }

  public async login(adminCred: { email: string; password: string }): Promise<any> {
    try {
      const { email, password } = adminCred || {};

      if (!email || !password) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Email and password are required.');
      }

      const normalizedEmail = email.toLowerCase().trim();
      const admin = await DB.Models.Admin.findOne({ email: normalizedEmail });

      if (!admin) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'No account found with this email.');
      }

      if (!admin.isAccountVerified) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Your admin account is not yet verified.');
      }

      if (!admin.password) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'This account has no password set.');
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Incorrect password. Please try again.');
      }

      admin.isAccountInRecovery = false;
      await admin.save();

      const payload = {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        isAdmin: true,
      };

      const token = signJwt(payload);

      return {
        admin: admin.toObject(),
        token,
      };
    } catch (err: any) {
      const message =
        err instanceof RouteError ? err.message : 'An unexpected error occurred during login.';
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, message);
    }
  }



  


 


  



  

  public async updateProperty(propertyId: string, propertyType: string, propertyData: any) {
    try {
      if (propertyType === 'rent') {
        await this.propertyRentController.update(propertyId, propertyData, 'Admin' as any);
      } else if (propertyType === 'sell') {
        await this.propertySellController.update(propertyId, propertyData, 'Admin');
      } else {
        throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid property type');
      }
      return { message: 'Property updated successfully' };
    } catch (error) {
      throw new RouteError(HttpStatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  // ===============================================================

  public async getAllBuyersWithPreferences() {
  const buyers = await DB.Models.Buyer.find({})
    .select('email fullName phoneNumber createdAt');

  const buyerIds = buyers.map((b) => b._id);

  const preferences = await DB.Models.Preference.find({ buyer: { $in: buyerIds } });

  return {
    buyers,
    preferences,
  };
}

public async getPreferencesByBuyerId(buyerId: string) {
  const buyerObjectId  = new mongoose.Types.ObjectId(buyerId)
  const preferences = await DB.Models.Preference.find({ buyer:buyerObjectId })
    .sort({ createdAt: -1 });

  return preferences;
}


  public async getSubmittedBriefs(
    userType: string,
    filters?: {
      isApproved?: string;
      isRejected?: string;
      isAvailable?: string;
      page?: string;
      limit?: string;
    }
  ) {
    if (!userType || !['Landowners', 'Agent'].includes(userType)) {
      throw new RouteError(HttpStatusCodes.NOT_ACCEPTABLE, 'Invalid User type');
    }

    const matchStage: any = {
      'owner.userType': userType,
    };

    if (filters?.isApproved !== undefined) {
      matchStage.isApproved = filters.isApproved === 'true';
    }

    if (filters?.isRejected !== undefined) {
      matchStage.isRejected = filters.isRejected === 'true';
    }

    if (filters?.isAvailable !== undefined) {
      matchStage.isAvailable = filters.isAvailable;
    }

    const page = parseInt(filters?.page || '1');
    const limit = parseInt(filters?.limit || '10');
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: '$owner' },
      { $match: matchStage },
      {
        $lookup: {
          from: 'preferences',
          localField: 'preferenceId',
          foreignField: '_id',
          as: 'preferenceId',
        },
      },
      {
        $unwind: {
          path: '$preferenceId',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const result = await DB.Models.Property.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      perPage: limit,
    };
  }



  public async approveBrief(briefId: string) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(briefId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid brief ID');
    }

    const brief = await DB.Models.Property.findById(briefId);
    if (!brief) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Brief not found');
    }

    if (brief.isApproved) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Brief is already approved');
    }

    brief.isApproved = true;
    brief.isRejected = false;
    await brief.save();

    return {
      message: 'Brief approved successfully',
      briefId: brief._id,
    };
  }

   public async rejectBrief(briefId: string) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(briefId)) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Invalid brief ID');
    }

    const brief = await DB.Models.Property.findById(briefId);
    if (!brief) {
      throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Brief not found');
    }

    if (brief.isRejected) {
      throw new RouteError(HttpStatusCodes.BAD_REQUEST, 'Brief is already rejected');
    }

    brief.isRejected = true;
    brief.isApproved = false;
    await brief.save();

    return {
      message: 'Brief rejected successfully',
      briefId: brief._id,
    };
  }

  public async getApprovedBriefs() {
    const briefs = await DB.Models.Property.find({isApproved: true, isRejected: false })
      .populate('owner', 'email fullName phoneNumber')
      .sort({ createdAt: -1 });

    return briefs;
  }

  public async getRejectedBriefs() {
    const briefs = await DB.Models.Property.find({isApproved: false, isRejected: true })
      .populate('owner', 'email fullName phoneNumber')
      .sort({ createdAt: -1 });

    return briefs;
  }


  // 2. Admin selects briefs to match a buyer's preference and notify the buyer
  public async matchBriefsToPreference(preferenceId: string, briefIds: string[]) {
    type PopulatedPreference = Omit<IPreference, 'buyer'> & {
      buyer: { email: string; fullName: string };
    };

    const preferenceObjectId = new mongoose.Types.ObjectId(preferenceId)

    const preference = await DB.Models.Preference.findById(preferenceObjectId)
      .populate('buyer', 'email fullName')

    if (!preference) throw new RouteError(HttpStatusCodes.NOT_FOUND, 'Preference not found');

    const buyer = preference.buyer as any
    let theStatus = preference.status as string
    
    const briefMatches = [];
    const BriefMatchModel = DB.Models.BriefMatch as IBriefMatchModel;

    for (const briefId of briefIds) {
      const briefObjectId = new mongoose.Types.ObjectId(briefId)
      

      const alreadyExists = await BriefMatchModel.findOne({
        brief: briefObjectId,
        preference: preferenceObjectId,
      });

      if (!alreadyExists) {
        const privateLink = `${process.env.CLIENT_LINK}api/buyers/brief-matches?preference=${preferenceId}`;

        const newMatch = await BriefMatchModel.create({
          brief: briefObjectId,
          preference: preferenceObjectId,
          privateLink,
          status: 'sent',
        });

        briefMatches.push(newMatch);
      }
    }

    if (briefMatches.length > 0) {
      const emailHtml = preferenceMatchingTemplate(`
        <p>Dear ${buyer.fullName},</p>
        <p>Good news! We’ve found the perfect property brief for you.</p>
        <p>Please click the button below to view it.</p>
        <p><a href="${process.env.CLIENT_LINK}api/buyers/brief-matches?preference=${preferenceId}">View Property</a></p>
        <p>If you have any questions, feel free to contact us.</p>
      `);

      theStatus  = 'matched'
      await preference.save()

      await sendEmail({
        to:buyer.email,
        subject: 'Matching Properties Found',
        html: emailHtml,
        text: emailHtml,
      });
    }

    return {
      message: 'Briefs matched and email sent to buyer.',
      matchedCount: briefMatches.length,
    };
  }
}

