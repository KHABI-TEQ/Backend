import { Types } from "mongoose";
import { DB } from "../controllers";
import { AnalyticsStats, BookingStats, InspectionStats, OverviewStats, PreferenceStats, PropertyStats, ReferralStats, SubscriptionStats, TransactionStats, UserStats } from "../types/dashboardStats";

export type TimeFilter = "7days" | "30days" | "90days" | "365days" | "range";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardStats {
  overview: {
    totalProperties: number;
    totalPreferences: number;
    totalTransactions: number;
    totalRevenue: number;
    totalUsers: number;
    activeListings: number;
    pendingApprovals: number;
    matchedPreferences: number;
    totalInspections: number;
    totalBookings: number;
    totalAgents: number;
    activeSubscriptions: number;
    totalReferrals: number;
  };
  propertyStats: {
    byType: { type: string; count: number }[];
    byCategory: { category: string; count: number }[];
    byStatus: { status: string; count: number }[];
    byLocation: { state: string; count: number }[];
    averagePrice: number;
    premiumListings: number;
  };
  transactionStats: {
    successfulByType: { type: string; count: number; totalAmount: number }[];
    byStatus: { status: string; count: number }[];
    successfulByFlow: {flow: string; count: number, totalAmount: number }[];
    totalSuccessful: number;
    totalPending: number;
    totalFailed: number;
    averageSuccessfulTransactionValue: number;
  };
  userStats: {
    byType: { userType: string; count: number }[];
    verifiedUsers: number;
    activeUsers: number;
    newUsers: number;
    byAccountStatus: { status: string; count: number }[];
    totalAgents: number;
    agentBreakdown: {
      byType: { agentType: string; count: number }[];
      byKycStatus: { kycStatus: string; count: number }[];
      withActiveSubscription: number;
      byRegion: { region: string; count: number }[];
    };
  };
  preferenceStats: {
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
    matched: number;
    pending: number;
  };
  inspectionStats: {
    byStatus: { status: string; count: number }[];
    byType: { inspectionType: string; count: number }[];
    byMode: { inspectionMode: string; count: number }[];
    byStage: { stage: string; count: number }[];
    byPropertyType: { propertyType: string; count: number }[];
    totalActive: number;
    totalCompleted: number;
    totalCancelled: number;
    averageCounterCount: number;
    withNegotiation: number;
    withLOI: number;
    inspectionReportStats: {
      byStatus: { status: string; count: number }[];
      byBuyerInterest: { interest: string; count: number }[];
      successfulInspections: number;
    };
  };
  bookingStats: {
    byStatus: { status: string; count: number }[];
    byOwnerResponse: { response: string; count: number }[];
    totalConfirmed: number;
    totalCompleted: number;
    totalCancelled: number;
    totalPending: number;
    averageGuestsPerBooking: number;
    averageBookingDuration: number; // in days
  };
  subscriptionStats: {
    byStatus: { status: string; count: number }[];
    byPlan: { plan: string; count: number }[];
    activeSubscriptions: number;
    expiredSubscriptions: number;
    autoRenewEnabled: number;
    totalSubscriptionRevenue: number;
  };
  referralStats: {
    byRewardType: { rewardType: string; count: number }[];
    byRewardStatus: { rewardStatus: string; count: number }[];
    totalRewards: number;
    grantedRewards: number;
    pendingRewards: number;
    failedRewards: number;
    totalRewardAmount: number;
    averageRewardAmount: number;
    topReferrers: { userId: Types.ObjectId; totalReferrals: number; totalRewards: number }[];
  };
  analytics: {
    propertyTrends: {
      date: string;
      count: number;
      revenue: number;
    }[];
    transactionTrends: {
      date: string;
      count: number;
      amount: number;
    }[];
    userGrowth: {
      date: string;
      count: number;
      cumulative: number;
    }[];
    preferenceTrends: {
      date: string;
      count: number;
      matched: number;
    }[];
    inspectionTrends: {
      date: string;
      count: number;
      completed: number;
    }[];
    bookingTrends: {
      date: string;
      count: number;
      confirmed: number;
    }[];
    subscriptionTrends: {
      date: string;
      count: number;
      active: number;
    }[];
    revenueByType: {
      type: string;
      amount: number;
      percentage: number;
    }[];
  };
}

export class DashboardStatsService {
  private propertyModel = DB.Models.Property;
  private preferenceModel = DB.Models.Preference;
  private transactionModel = DB.Models.NewTransaction;
  private userModel = DB.Models.User;
  private matchedModel = DB.Models.MatchedPreferenceProperty;
  private inspectionModel = DB.Models.InspectionBooking;
  private bookingModel = DB.Models.Booking;
  private agentModel = DB.Models.Agent;
  private subscriptionModel = DB.Models.UserSubscriptionSnapshot;
  private referralModel = DB.Models.ReferralLog;

  private getDateRange(filter: TimeFilter, customRange?: DateRange): DateRange {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (filter) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "365days":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "range":
        if (!customRange) {
          throw new Error("Custom date range required for 'range' filter");
        }
        startDate = customRange.startDate;
        endDate = customRange.endDate;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  async getStats(filter: TimeFilter, customRange?: DateRange): Promise<DashboardStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Overview Stats
    const [
      totalProperties,
      totalPreferences,
      totalTransactions,
      totalUsers,
      activeListings,
      pendingApprovals,
      matchedPreferences,
      totalInspections,
      totalBookings,
      totalAgents,
      activeSubscriptions,
      totalReferrals,
      revenueResult
    ] = await Promise.all([
      this.propertyModel.countDocuments(dateFilter),
      this.preferenceModel.countDocuments(dateFilter),
      this.transactionModel.countDocuments({ ...dateFilter, transactionFlow: "internal" }),
      this.userModel.countDocuments(dateFilter),
      this.propertyModel.countDocuments({ ...dateFilter, isAvailable: true }),
      this.propertyModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.matchedModel.countDocuments(dateFilter),
      this.inspectionModel.countDocuments(dateFilter),
      this.bookingModel.countDocuments(dateFilter),
      this.agentModel.countDocuments(dateFilter),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "active" }),
      this.referralModel.countDocuments(dateFilter),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: "success", transactionFlow: "internal" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    // Property Stats
    const [propertyByType, propertyByCategory, propertyByStatus, propertyByLocation, avgPriceResult, premiumListings] = await Promise.all([
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$briefType", count: { $sum: 1 } } },
        { $project: { type: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        { $project: { category: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$location.state", count: { $sum: 1 } } },
        { $project: { state: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 36 }
      ]),
      this.propertyModel.aggregate([
        { $match: { ...dateFilter, price: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgPrice: { $avg: "$price" } } }
      ]),
      this.propertyModel.countDocuments({ ...dateFilter, isPremium: true })
    ]);

    const averagePrice = avgPriceResult[0]?.avgPrice || 0;

    // Transaction Stats
    const [successTransactionByType, transactionByStatus, successTransactionByFlow, successfulTxns, pendingTxns, failedTxns, avgSuccessTxnValue] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: "$transactionType", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
        { $project: { type: "$_id", count: 1, totalAmount: 1, _id: 0 } }
      ]),
      this.transactionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: "$transactionFlow", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
        { $project: { flow: "$_id", count: 1, totalAmount: 1, _id: 0 } }
      ]),
      this.transactionModel.countDocuments({ ...dateFilter, status: "success" }),
      this.transactionModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.transactionModel.countDocuments({ ...dateFilter, status: "failed" }),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: null, avg: { $avg: "$amount" } } }
      ])
    ]);

    const averageSuccessfulTransactionValue = avgSuccessTxnValue[0]?.avg || 0;

    // Enhanced User Stats
    const [
      userByType, 
      verifiedUsers, 
      activeUsers, 
      newUsers, 
      userByAccountStatus,
      agentByType,
      agentByKycStatus,
      agentWithActiveSubscription,
      agentByRegion
    ] = await Promise.all([
      this.userModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$userType", count: { $sum: 1 } } },
        { $project: { userType: "$_id", count: 1, _id: 0 } }
      ]),
      this.userModel.countDocuments({ ...dateFilter, isAccountVerified: true }),
      this.userModel.countDocuments({ ...dateFilter, accountStatus: "active" }),
      this.userModel.countDocuments(dateFilter),
      this.userModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$accountStatus", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$agentType", count: { $sum: 1 } } },
        { $project: { agentType: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$kycStatus", count: { $sum: 1 } } },
        { $project: { kycStatus: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "usersubscriptionsnapshots",
            localField: "userId",
            foreignField: "user",
            as: "subscriptions"
          }
        },
        {
          $match: {
            "subscriptions.status": "active",
            "subscriptions.expiresAt": { $gte: new Date() }
          }
        },
        { $count: "total" }
      ]).then(result => result[0]?.total || 0),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $unwind: "$regionOfOperation" },
        { $group: { _id: "$regionOfOperation", count: { $sum: 1 } } },
        { $project: { region: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    // Preference Stats
    const [preferenceByType, preferenceByStatus, matchedPrefs, pendingPrefs] = await Promise.all([
      this.preferenceModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$preferenceType", count: { $sum: 1 } } },
        { $project: { type: "$_id", count: 1, _id: 0 } }
      ]),
      this.preferenceModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.preferenceModel.countDocuments({ ...dateFilter, status: "matched" }),
      this.preferenceModel.countDocuments({ ...dateFilter, status: "pending" })
    ]);

    // Inspection Stats
    const [
      inspectionByStatus,
      inspectionByType,
      inspectionByMode,
      inspectionByStage,
      inspectionByPropertyType,
      activeInspections,
      completedInspections,
      cancelledInspections,
      avgCounterCount,
      withNegotiation,
      withLOI,
      inspectionReportByStatus,
      inspectionReportByInterest,
      successfulInspections
    ] = await Promise.all([
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$inspectionType", count: { $sum: 1 } } },
        { $project: { inspectionType: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$inspectionMode", count: { $sum: 1 } } },
        { $project: { inspectionMode: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
        { $project: { stage: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        { $project: { propertyType: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: { $in: ["negotiation", "inspection"] } }),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: "completed" }),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: "cancelled" }),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: "$counterCount" } } }
      ]).then(result => result[0]?.avg || 0),
      this.inspectionModel.countDocuments({ ...dateFilter, isNegotiating: true }),
      this.inspectionModel.countDocuments({ ...dateFilter, isLOI: true }),
      this.inspectionModel.aggregate([
        { $match: { ...dateFilter, "inspectionReport.status": { $exists: true } } },
        { $group: { _id: "$inspectionReport.status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: { ...dateFilter, "inspectionReport.buyerInterest": { $exists: true } } },
        { $group: { _id: "$inspectionReport.buyerInterest", count: { $sum: 1 } } },
        { $project: { interest: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.countDocuments({ ...dateFilter, "inspectionReport.wasSuccessful": true })
    ]);

    // Booking Stats
    const [
      bookingByStatus,
      bookingByOwnerResponse,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      avgGuests,
      avgDuration
    ] = await Promise.all([
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$ownerResponse.response", count: { $sum: 1 } } },
        { $project: { response: "$_id", count: 1, _id: 0 } }
      ]),
      this.bookingModel.countDocuments({ ...dateFilter, status: "confirmed" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "completed" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "cancelled" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: "$bookingDetails.guestNumber" } } }
      ]).then(result => result[0]?.avg || 0),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        {
          $project: {
            duration: {
              $divide: [
                { $subtract: ["$bookingDetails.checkOutDateTime", "$bookingDetails.checkInDateTime"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $group: { _id: null, avg: { $avg: "$duration" } } }
      ]).then(result => result[0]?.avg || 0)
    ]);

    // Subscription Stats
    const [
      subscriptionByStatus,
      subscriptionByPlan,
      activeSubCount,
      expiredSubCount,
      autoRenewCount,
      subscriptionRevenue
    ] = await Promise.all([
      this.subscriptionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.subscriptionModel.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "subscriptionplans",
            localField: "plan",
            foreignField: "_id",
            as: "planDetails"
          }
        },
        { $unwind: { path: "$planDetails", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$planDetails.name", count: { $sum: 1 } } },
        { $project: { plan: "$_id", count: 1, _id: 0 } }
      ]),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "active" }),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "expired" }),
      this.subscriptionModel.countDocuments({ ...dateFilter, autoRenew: true }),
      this.transactionModel.aggregate([
        { 
          $match: { 
            ...dateFilter, 
            status: "success",
            transactionType: { $in: ["subscription", "plan_purchase"] }
          } 
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Referral Stats
    const [
      referralByType,
      referralByStatus,
      totalRewards,
      grantedRewards,
      pendingRewards,
      failedRewards,
      rewardAmountData,
      topReferrers
    ] = await Promise.all([
      this.referralModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$rewardType", count: { $sum: 1 } } },
        { $project: { rewardType: "$_id", count: 1, _id: 0 } }
      ]),
      this.referralModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$rewardStatus", count: { $sum: 1 } } },
        { $project: { rewardStatus: "$_id", count: 1, _id: 0 } }
      ]),
      this.referralModel.countDocuments(dateFilter),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "granted" }),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "pending" }),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "failed" }),
      this.referralModel.aggregate([
        { $match: dateFilter },
        { 
          $group: { 
            _id: null, 
            total: { $sum: "$rewardAmount" },
            avg: { $avg: "$rewardAmount" }
          } 
        }
      ]),
      this.referralModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$referrerId",
            totalReferrals: { $sum: 1 },
            totalRewards: { $sum: "$rewardAmount" }
          }
        },
        { $sort: { totalReferrals: -1 } },
        { $limit: 10 },
        {
          $project: {
            userId: "$_id",
            totalReferrals: 1,
            totalRewards: 1,
            _id: 0
          }
        }
      ])
    ]);

    const totalRewardAmount = rewardAmountData[0]?.total || 0;
    const averageRewardAmount = rewardAmountData[0]?.avg || 0;

    // Analytics - Property Trends
    const interval = filter === "7days" ? "day" : filter === "30days" ? "day" : "month";
    const propertyTrends = await this.propertyModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$price", 0] } }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, revenue: 1, _id: 0 } }
    ]);

    // Analytics - Transaction Trends
    const transactionTrends = await this.transactionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, amount: 1, _id: 0 } }
    ]);

    // Analytics - User Growth
    const userGrowth = await this.userModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let cumulative = 0;
    const userGrowthWithCumulative = userGrowth.map(item => {
      cumulative += item.count;
      return {
        date: item._id,
        count: item.count,
        cumulative
      };
    });

    // Analytics - Preference Trends
    const preferenceTrends = await this.preferenceModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          matched: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "matched"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, matched: 1, _id: 0 } }
    ]);

    // Analytics - Inspection Trends
    const inspectionTrends = await this.inspectionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            stage: "$stage"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$_id.stage", "completed"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, completed: 1, _id: 0 } }
    ]);

    // Analytics - Booking Trends
    const bookingTrends = await this.bookingModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          confirmed: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "confirmed"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, confirmed: 1, _id: 0 } }
    ]);

    // Analytics - Subscription Trends
    const subscriptionTrends = await this.subscriptionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          active: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "active"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, active: 1, _id: 0 } }
    ]);

    // Analytics - Revenue by Type
    const revenueByTypeData = await this.transactionModel.aggregate([
      { $match: { ...dateFilter, status: "success" } },
      {
        $group: {
          _id: "$transactionType",
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const totalRevenueForPercentage = revenueByTypeData.reduce((sum, item) => sum + item.amount, 0);
    const revenueByType = revenueByTypeData.map(item => ({
      type: item._id,
      amount: item.amount,
      percentage: totalRevenueForPercentage > 0 ? (item.amount / totalRevenueForPercentage) * 100 : 0
    }));

    return {
      overview: {
        totalProperties,
        totalPreferences,
        totalTransactions,
        totalRevenue,
        totalUsers,
        activeListings,
        pendingApprovals,
        matchedPreferences,
        totalInspections,
        totalBookings,
        totalAgents,
        activeSubscriptions,
        totalReferrals
      },
      propertyStats: {
        byType: propertyByType,
        byCategory: propertyByCategory,
        byStatus: propertyByStatus,
        byLocation: propertyByLocation,
        averagePrice,
        premiumListings
      },
      transactionStats: {
        successfulByType: successTransactionByType,
        byStatus: transactionByStatus,
        successfulByFlow: successTransactionByFlow,
        totalSuccessful: successfulTxns,
        totalPending: pendingTxns,
        totalFailed: failedTxns,
        averageSuccessfulTransactionValue
      },
      userStats: {
        byType: userByType,
        verifiedUsers,
        activeUsers,
        newUsers,
        byAccountStatus: userByAccountStatus,
        totalAgents,
        agentBreakdown: {
          byType: agentByType,
          byKycStatus: agentByKycStatus,
          withActiveSubscription: agentWithActiveSubscription,
          byRegion: agentByRegion
        }
      },
      preferenceStats: {
        byType: preferenceByType,
        byStatus: preferenceByStatus,
        matched: matchedPrefs,
        pending: pendingPrefs
      },
      inspectionStats: {
        byStatus: inspectionByStatus,
        byType: inspectionByType,
        byMode: inspectionByMode,
        byStage: inspectionByStage,
        byPropertyType: inspectionByPropertyType,
        totalActive: activeInspections,
        totalCompleted: completedInspections,
        totalCancelled: cancelledInspections,
        averageCounterCount: avgCounterCount,
        withNegotiation,
        withLOI,
        inspectionReportStats: {
          byStatus: inspectionReportByStatus,
          byBuyerInterest: inspectionReportByInterest,
          successfulInspections
        }
      },
      bookingStats: {
        byStatus: bookingByStatus,
        byOwnerResponse: bookingByOwnerResponse,
        totalConfirmed: confirmedBookings,
        totalCompleted: completedBookings,
        totalCancelled: cancelledBookings,
        totalPending: pendingBookings,
        averageGuestsPerBooking: avgGuests,
        averageBookingDuration: avgDuration
      },
      subscriptionStats: {
        byStatus: subscriptionByStatus,
        byPlan: subscriptionByPlan,
        activeSubscriptions: activeSubCount,
        expiredSubscriptions: expiredSubCount,
        autoRenewEnabled: autoRenewCount,
        totalSubscriptionRevenue: subscriptionRevenue
      },
      referralStats: {
        byRewardType: referralByType,
        byRewardStatus: referralByStatus,
        totalRewards,
        grantedRewards,
        pendingRewards,
        failedRewards,
        totalRewardAmount,
        averageRewardAmount,
        topReferrers
      },
      analytics: {
        propertyTrends,
        transactionTrends,
        userGrowth: userGrowthWithCumulative,
        preferenceTrends,
        inspectionTrends,
        bookingTrends,
        subscriptionTrends,
        revenueByType
      }
    };
  }







  async getOverviewStats(filter: TimeFilter, customRange?: DateRange): Promise<OverviewStats> {

    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Overview Stats
    const [
      totalProperties,
      totalPreferences,
      totalTransactions,
      totalUsers,
      activeListings,
      pendingApprovals,
      matchedPreferences,
      totalInspections,
      totalBookings,
      totalAgents,
      activeSubscriptions,
      totalReferrals,
      revenueResult
    ] = await Promise.all([
      this.propertyModel.countDocuments(dateFilter),
      this.preferenceModel.countDocuments(dateFilter),
      this.transactionModel.countDocuments({ ...dateFilter, transactionFlow: "internal" }),
      this.userModel.countDocuments(dateFilter),
      this.propertyModel.countDocuments({ ...dateFilter, isAvailable: true }),
      this.propertyModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.matchedModel.countDocuments(dateFilter),
      this.inspectionModel.countDocuments(dateFilter),
      this.bookingModel.countDocuments(dateFilter),
      this.agentModel.countDocuments(dateFilter),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "active" }),
      this.referralModel.countDocuments(dateFilter),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: "success", transactionFlow: "internal" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    return {
        totalProperties,
        totalPreferences,
        totalTransactions,
        totalRevenue,
        totalUsers,
        activeListings,
        pendingApprovals,
        matchedPreferences,
        totalInspections,
        totalBookings,
        totalAgents,
        activeSubscriptions,
        totalReferrals
    }

  }


  async getUserStats(filter: TimeFilter, customRange?: DateRange): Promise<UserStats> {

    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Enhanced User Stats
    const [
      userByType, 
      verifiedUsers, 
      activeUsers, 
      newUsers, 
      userByAccountStatus,
      agentByType,
      agentByKycStatus,
      agentWithActiveSubscription,
      agentByRegion,
      totalAgents
    ] = await Promise.all([
      this.userModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$userType", count: { $sum: 1 } } },
        { $project: { userType: "$_id", count: 1, _id: 0 } }
      ]),
      this.userModel.countDocuments({ ...dateFilter, isAccountVerified: true }),
      this.userModel.countDocuments({ ...dateFilter, accountStatus: "active" }),
      this.userModel.countDocuments(dateFilter),
      this.userModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$accountStatus", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$agentType", count: { $sum: 1 } } },
        { $project: { agentType: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$kycStatus", count: { $sum: 1 } } },
        { $project: { kycStatus: "$_id", count: 1, _id: 0 } }
      ]),
      this.agentModel.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "usersubscriptionsnapshots",
            localField: "userId",
            foreignField: "user",
            as: "subscriptions"
          }
        },
        {
          $match: {
            "subscriptions.status": "active",
            "subscriptions.expiresAt": { $gte: new Date() }
          }
        },
        { $count: "total" }
      ]).then(result => result[0]?.total || 0),
      this.agentModel.aggregate([
        { $match: dateFilter },
        { $unwind: "$regionOfOperation" },
        { $group: { _id: "$regionOfOperation", count: { $sum: 1 } } },
        { $project: { region: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      this.agentModel.countDocuments(dateFilter),
    ]);

    return {
        byType: userByType,
        verifiedUsers,
        activeUsers,
        newUsers,
        byAccountStatus: userByAccountStatus,
        totalAgents,
        agentBreakdown: {
          byType: agentByType,
          byKycStatus: agentByKycStatus,
          withActiveSubscription: agentWithActiveSubscription,
          byRegion: agentByRegion
        }
    }

  }


  async getPropertyStats(filter: TimeFilter, customRange?: DateRange): Promise<PropertyStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Property Stats
    const [propertyByType, propertyByCategory, propertyByStatus, propertyByLocation, avgPriceResult, premiumListings] = await Promise.all([
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$briefType", count: { $sum: 1 } } },
        { $project: { type: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        { $project: { category: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.propertyModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$location.state", count: { $sum: 1 } } },
        { $project: { state: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 36 }
      ]),
      this.propertyModel.aggregate([
        { $match: { ...dateFilter, price: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgPrice: { $avg: "$price" } } }
      ]),
      this.propertyModel.countDocuments({ ...dateFilter, isPremium: true })
    ]);

    const averagePrice = avgPriceResult[0]?.avgPrice || 0;

    return {
        byType: propertyByType,
        byCategory: propertyByCategory,
        byStatus: propertyByStatus,
        byLocation: propertyByLocation,
        averagePrice,
        premiumListings
    }
  }


  async getTransactionStats(filter: TimeFilter, customRange?: DateRange): Promise<TransactionStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Transaction Stats
    const [successTransactionByType, transactionByStatus, successTransactionByFlow, successfulTxns, pendingTxns, failedTxns, avgSuccessTxnValue] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: "$transactionType", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
        { $project: { type: "$_id", count: 1, totalAmount: 1, _id: 0 } }
      ]),
      this.transactionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: "$transactionFlow", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
        { $project: { flow: "$_id", count: 1, totalAmount: 1, _id: 0 } }
      ]),
      this.transactionModel.countDocuments({ ...dateFilter, status: "success" }),
      this.transactionModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.transactionModel.countDocuments({ ...dateFilter, status: "failed" }),
      this.transactionModel.aggregate([
        { $match: { ...dateFilter, status: 'success' } },
        { $group: { _id: null, avg: { $avg: "$amount" } } }
      ])
    ]);

    const averageSuccessfulTransactionValue = avgSuccessTxnValue[0]?.avg || 0;

    return {
        successfulByType: successTransactionByType,
        byStatus: transactionByStatus,
        successfulByFlow: successTransactionByFlow,
        totalSuccessful: successfulTxns,
        totalPending: pendingTxns,
        totalFailed: failedTxns,
        averageSuccessfulTransactionValue
    }

  }


  async getBookingStats(filter: TimeFilter, customRange?: DateRange): Promise<BookingStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Booking Stats
    const [
      bookingByStatus,
      bookingByOwnerResponse,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      avgGuests,
      avgDuration
    ] = await Promise.all([
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$ownerResponse.response", count: { $sum: 1 } } },
        { $project: { response: "$_id", count: 1, _id: 0 } }
      ]),
      this.bookingModel.countDocuments({ ...dateFilter, status: "confirmed" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "completed" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "cancelled" }),
      this.bookingModel.countDocuments({ ...dateFilter, status: "pending" }),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: "$bookingDetails.guestNumber" } } }
      ]).then(result => result[0]?.avg || 0),
      this.bookingModel.aggregate([
        { $match: dateFilter },
        {
          $project: {
            duration: {
              $divide: [
                { $subtract: ["$bookingDetails.checkOutDateTime", "$bookingDetails.checkInDateTime"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $group: { _id: null, avg: { $avg: "$duration" } } }
      ]).then(result => result[0]?.avg || 0)
    ]);

    return {
        byStatus: bookingByStatus,
        byOwnerResponse: bookingByOwnerResponse,
        totalConfirmed: confirmedBookings,
        totalCompleted: completedBookings,
        totalCancelled: cancelledBookings,
        totalPending: pendingBookings,
        averageGuestsPerBooking: avgGuests,
        averageBookingDuration: avgDuration
    }
  }


  async getInspectionStats(filter: TimeFilter, customRange?: DateRange): Promise<InspectionStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Inspection Stats
    const [
      inspectionByStatus,
      inspectionByType,
      inspectionByMode,
      inspectionByStage,
      inspectionByPropertyType,
      activeInspections,
      completedInspections,
      cancelledInspections,
      avgCounterCount,
      withNegotiation,
      withLOI,
      inspectionReportByStatus,
      inspectionReportByInterest,
      successfulInspections
    ] = await Promise.all([
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$inspectionType", count: { $sum: 1 } } },
        { $project: { inspectionType: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$inspectionMode", count: { $sum: 1 } } },
        { $project: { inspectionMode: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
        { $project: { stage: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$propertyType", count: { $sum: 1 } } },
        { $project: { propertyType: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: { $in: ["negotiation", "inspection"] } }),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: "completed" }),
      this.inspectionModel.countDocuments({ ...dateFilter, stage: "cancelled" }),
      this.inspectionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: "$counterCount" } } }
      ]).then(result => result[0]?.avg || 0),
      this.inspectionModel.countDocuments({ ...dateFilter, isNegotiating: true }),
      this.inspectionModel.countDocuments({ ...dateFilter, isLOI: true }),
      this.inspectionModel.aggregate([
        { $match: { ...dateFilter, "inspectionReport.status": { $exists: true } } },
        { $group: { _id: "$inspectionReport.status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.aggregate([
        { $match: { ...dateFilter, "inspectionReport.buyerInterest": { $exists: true } } },
        { $group: { _id: "$inspectionReport.buyerInterest", count: { $sum: 1 } } },
        { $project: { interest: "$_id", count: 1, _id: 0 } }
      ]),
      this.inspectionModel.countDocuments({ ...dateFilter, "inspectionReport.wasSuccessful": true })
    ]);

    return {
        byStatus: inspectionByStatus,
        byType: inspectionByType,
        byMode: inspectionByMode,
        byStage: inspectionByStage,
        byPropertyType: inspectionByPropertyType,
        totalActive: activeInspections,
        totalCompleted: completedInspections,
        totalCancelled: cancelledInspections,
        averageCounterCount: avgCounterCount,
        withNegotiation,
        withLOI,
        inspectionReportStats: {
          byStatus: inspectionReportByStatus,
          byBuyerInterest: inspectionReportByInterest,
          successfulInspections
        }
    }
  }


  async getAgentSubscriptionStats(filter: TimeFilter, customRange?: DateRange): Promise<SubscriptionStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Subscription Stats
    const [
      subscriptionByStatus,
      subscriptionByPlan,
      activeSubCount,
      expiredSubCount,
      autoRenewCount,
      subscriptionRevenue
    ] = await Promise.all([
      this.subscriptionModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.subscriptionModel.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "subscriptionplans",
            localField: "plan",
            foreignField: "_id",
            as: "planDetails"
          }
        },
        { $unwind: { path: "$planDetails", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$planDetails.name", count: { $sum: 1 } } },
        { $project: { plan: "$_id", count: 1, _id: 0 } }
      ]),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "active" }),
      this.subscriptionModel.countDocuments({ ...dateFilter, status: "expired" }),
      this.subscriptionModel.countDocuments({ ...dateFilter, autoRenew: true }),
      this.transactionModel.aggregate([
        { 
          $match: { 
            ...dateFilter, 
            status: "success",
            transactionType: { $in: ["subscription", "plan_purchase"] }
          } 
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    return {
        byStatus: subscriptionByStatus,
        byPlan: subscriptionByPlan,
        activeSubscriptions: activeSubCount,
        expiredSubscriptions: expiredSubCount,
        autoRenewEnabled: autoRenewCount,
        totalSubscriptionRevenue: subscriptionRevenue
    }

  }


  async getPreferenceStats(filter: TimeFilter, customRange?: DateRange): Promise<PreferenceStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Preference Stats
    const [preferenceByType, preferenceByStatus, matchedPrefs, pendingPrefs] = await Promise.all([
      this.preferenceModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$preferenceType", count: { $sum: 1 } } },
        { $project: { type: "$_id", count: 1, _id: 0 } }
      ]),
      this.preferenceModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } }
      ]),
      this.preferenceModel.countDocuments({ ...dateFilter, status: "matched" }),
      this.preferenceModel.countDocuments({ ...dateFilter, status: "pending" })
    ]);

    return {
        byType: preferenceByType,
        byStatus: preferenceByStatus,
        matched: matchedPrefs,
        pending: pendingPrefs
    }
  }


  async getReferralStats(filter: TimeFilter, customRange?: DateRange): Promise<ReferralStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Referral Stats
    const [
      referralByType,
      referralByStatus,
      totalRewards,
      grantedRewards,
      pendingRewards,
      failedRewards,
      rewardAmountData,
      topReferrers
    ] = await Promise.all([
      this.referralModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$rewardType", count: { $sum: 1 } } },
        { $project: { rewardType: "$_id", count: 1, _id: 0 } }
      ]),
      this.referralModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$rewardStatus", count: { $sum: 1 } } },
        { $project: { rewardStatus: "$_id", count: 1, _id: 0 } }
      ]),
      this.referralModel.countDocuments(dateFilter),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "granted" }),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "pending" }),
      this.referralModel.countDocuments({ ...dateFilter, rewardStatus: "failed" }),
      this.referralModel.aggregate([
        { $match: dateFilter },
        { 
          $group: { 
            _id: null, 
            total: { $sum: "$rewardAmount" },
            avg: { $avg: "$rewardAmount" }
          } 
        }
      ]),
      this.referralModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: "$referrerId",
            totalReferrals: { $sum: 1 },
            totalRewards: { $sum: "$rewardAmount" }
          }
        },
        { $sort: { totalReferrals: -1 } },
        { $limit: 10 },
        {
          $project: {
            userId: "$_id",
            totalReferrals: 1,
            totalRewards: 1,
            _id: 0
          }
        }
      ])
    ]);

    const totalRewardAmount = rewardAmountData[0]?.total || 0;
    const averageRewardAmount = rewardAmountData[0]?.avg || 0;

    return {
        byRewardType: referralByType,
        byRewardStatus: referralByStatus,
        totalRewards,
        grantedRewards,
        pendingRewards,
        failedRewards,
        totalRewardAmount,
        averageRewardAmount,
        topReferrers
    }

  }


  async getAnalyticsStats(filter: TimeFilter, customRange?: DateRange): Promise<AnalyticsStats> {
    const dateRange = this.getDateRange(filter, customRange);
    const { startDate, endDate } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Analytics - Property Trends
    const interval = filter === "7days" ? "day" : filter === "30days" ? "day" : "month";
    const propertyTrends = await this.propertyModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$price", 0] } }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, revenue: 1, _id: 0 } }
    ]);

    // Analytics - Transaction Trends
    const transactionTrends = await this.transactionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, amount: 1, _id: 0 } }
    ]);

    // Analytics - User Growth
    const userGrowth = await this.userModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let cumulative = 0;
    const userGrowthWithCumulative = userGrowth.map(item => {
      cumulative += item.count;
      return {
        date: item._id,
        count: item.count,
        cumulative
      };
    });

    // Analytics - Preference Trends
    const preferenceTrends = await this.preferenceModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          matched: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "matched"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, matched: 1, _id: 0 } }
    ]);

    // Analytics - Inspection Trends
    const inspectionTrends = await this.inspectionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            stage: "$stage"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$_id.stage", "completed"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, completed: 1, _id: 0 } }
    ]);

    // Analytics - Booking Trends
    const bookingTrends = await this.bookingModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          confirmed: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "confirmed"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, confirmed: 1, _id: 0 } }
    ]);

    // Analytics - Subscription Trends
    const subscriptionTrends = await this.subscriptionModel.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: interval === "day" ? "%Y-%m-%d" : "%Y-%m",
                date: "$createdAt"
              }
            },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          count: { $sum: "$count" },
          active: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "active"] }, "$count", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, active: 1, _id: 0 } }
    ]);

    // Analytics - Revenue by Type
    const revenueByTypeData = await this.transactionModel.aggregate([
      { $match: { ...dateFilter, status: "success" } },
      {
        $group: {
          _id: "$transactionType",
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const totalRevenueForPercentage = revenueByTypeData.reduce((sum, item) => sum + item.amount, 0);
    const revenueByType = revenueByTypeData.map(item => ({
      type: item._id,
      amount: item.amount,
      percentage: totalRevenueForPercentage > 0 ? (item.amount / totalRevenueForPercentage) * 100 : 0
    }));

    return {
        propertyTrends,
        transactionTrends,
        userGrowth: userGrowthWithCumulative,
        preferenceTrends,
        inspectionTrends,
        bookingTrends,
        subscriptionTrends,
        revenueByType
    }
  }






  async getComparison(currentFilter: TimeFilter, previousFilter: TimeFilter): Promise<any> {
    const currentStats = await this.getStats(currentFilter);
    const previousStats = await this.getStats(previousFilter);

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      overview: {
        totalProperties: {
          current: currentStats.overview.totalProperties,
          previous: previousStats.overview.totalProperties,
          change: calculateChange(currentStats.overview.totalProperties, previousStats.overview.totalProperties)
        },
        totalRevenue: {
          current: currentStats.overview.totalRevenue,
          previous: previousStats.overview.totalRevenue,
          change: calculateChange(currentStats.overview.totalRevenue, previousStats.overview.totalRevenue)
        },
        totalUsers: {
          current: currentStats.overview.totalUsers,
          previous: previousStats.overview.totalUsers,
          change: calculateChange(currentStats.overview.totalUsers, previousStats.overview.totalUsers)
        },
        totalTransactions: {
          current: currentStats.overview.totalTransactions,
          previous: previousStats.overview.totalTransactions,
          change: calculateChange(currentStats.overview.totalTransactions, previousStats.overview.totalTransactions)
        },
        totalInspections: {
          current: currentStats.overview.totalInspections,
          previous: previousStats.overview.totalInspections,
          change: calculateChange(currentStats.overview.totalInspections, previousStats.overview.totalInspections)
        },
        totalBookings: {
          current: currentStats.overview.totalBookings,
          previous: previousStats.overview.totalBookings,
          change: calculateChange(currentStats.overview.totalBookings, previousStats.overview.totalBookings)
        },
        totalAgents: {
          current: currentStats.overview.totalAgents,
          previous: previousStats.overview.totalAgents,
          change: calculateChange(currentStats.overview.totalAgents, previousStats.overview.totalAgents)
        },
        activeSubscriptions: {
          current: currentStats.overview.activeSubscriptions,
          previous: previousStats.overview.activeSubscriptions,
          change: calculateChange(currentStats.overview.activeSubscriptions, previousStats.overview.activeSubscriptions)
        },
        totalReferrals: {
          current: currentStats.overview.totalReferrals,
          previous: previousStats.overview.totalReferrals,
          change: calculateChange(currentStats.overview.totalReferrals, previousStats.overview.totalReferrals)
        }
      },
      agents: {
        withActiveSubscription: {
          current: currentStats.userStats.agentBreakdown.withActiveSubscription,
          previous: previousStats.userStats.agentBreakdown.withActiveSubscription,
          change: calculateChange(
            currentStats.userStats.agentBreakdown.withActiveSubscription,
            previousStats.userStats.agentBreakdown.withActiveSubscription
          )
        }
      },
      inspections: {
        totalCompleted: {
          current: currentStats.inspectionStats.totalCompleted,
          previous: previousStats.inspectionStats.totalCompleted,
          change: calculateChange(currentStats.inspectionStats.totalCompleted, previousStats.inspectionStats.totalCompleted)
        },
        successfulInspections: {
          current: currentStats.inspectionStats.inspectionReportStats.successfulInspections,
          previous: previousStats.inspectionStats.inspectionReportStats.successfulInspections,
          change: calculateChange(
            currentStats.inspectionStats.inspectionReportStats.successfulInspections,
            previousStats.inspectionStats.inspectionReportStats.successfulInspections
          )
        }
      },
      bookings: {
        totalCompleted: {
          current: currentStats.bookingStats.totalCompleted,
          previous: previousStats.bookingStats.totalCompleted,
          change: calculateChange(currentStats.bookingStats.totalCompleted, previousStats.bookingStats.totalCompleted)
        }
      },
      referrals: {
        grantedRewards: {
          current: currentStats.referralStats.grantedRewards,
          previous: previousStats.referralStats.grantedRewards,
          change: calculateChange(currentStats.referralStats.grantedRewards, previousStats.referralStats.grantedRewards)
        },
        totalRewardAmount: {
          current: currentStats.referralStats.totalRewardAmount,
          previous: previousStats.referralStats.totalRewardAmount,
          change: calculateChange(currentStats.referralStats.totalRewardAmount, previousStats.referralStats.totalRewardAmount)
        }
      }
    };
  }
}