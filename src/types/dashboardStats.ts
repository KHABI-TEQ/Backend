import { Types } from "mongoose";

export interface CountLabel {
    label: string;
    count: number;
}

export interface OverviewStats {
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
    pendingFieldAgentRequests: number;
    openFieldAgentRepresentationRequests: number;
    liveListings: number;
    newListings: number;
    awaitingMatchPreferences: number;
    newPreferences: number;
    paidActiveSubscriptions: number;
    complimentaryActiveSubscriptions: number;
    paidRevenue: number;
    practitionersTotal: number;
    buyersTotal: number;
    newPractitioners: number;
    newBuyers: number;
    openInspections: number;
    newInspections: number;
    runningDealSites: number;
    pendingDealSites: number;
    activeSearchInsurance: number;
    pendingPublisherKyc: number;
    practitionersByType: { userType: string; label: string; count: number }[];
    listingsByKind: { type: string; count: number }[];
    revenueByType: { type: string; amount: number; count: number }[];
};

export interface PropertyStats {
    byType: { type: string; count: number }[];
    byCategory: { category: string; count: number }[];
    byListingKind: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
    byLocation: { state: string; count: number }[];
    averagePrice: number;
    premiumListings: number;
    liveListings: number;
    pendingApprovals: number;
    newListings: number;
}

export interface TransactionStats {
    successfulByType: { type: string; count: number; totalAmount: number }[];
    byStatus: { status: string; count: number }[];
    successfulByFlow: {flow: string; count: number, totalAmount: number }[];
    totalSuccessful: number;
    totalPending: number;
    totalFailed: number;
    averageSuccessfulTransactionValue: number;
    paidRevenue: number;
};

export interface UserStats {
    byType: { userType: string; count: number }[];
    verifiedUsers: number;
    activeUsers: number;
    newUsers: number;
    byAccountStatus: { status: string; count: number }[];
    totalAgents: number;
    buyersTotal: number;
    newBuyers: number;
    practitionersTotal: number;
    pendingPublisherKyc: number;
    agentBreakdown: {
      byType: { agentType: string; count: number }[];
      byKycStatus: { kycStatus: string; count: number }[];
      withActiveSubscription: number;
      byRegion: { region: string; count: number }[];
    };
};

export interface PreferenceStats {
    byType: { type: string; count: number }[];
    byMode: { mode: string; count: number }[];
    byStatus: { status: string; count: number }[];
    matched: number;
    pending: number;
    awaitingMatch: number;
    approved: number;
};

export interface InspectionStats {
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
    pendingFieldAgentRequests: number;
    acceptedFieldAgentRequestsAwaitingAssignment: number;
    openFieldAgentRepresentationRequests: number;
};

export interface BookingStats {
    byStatus: { status: string; count: number }[];
    byOwnerResponse: { response: string; count: number }[];
    totalConfirmed: number;
    totalCompleted: number;
    totalCancelled: number;
    totalPending: number;
    averageGuestsPerBooking: number;
    averageBookingDuration: number;
};

export interface SubscriptionStats {
    byStatus: { status: string; count: number }[];
    byPlan: { plan: string; count: number }[];
    byAudience: { audience: string; count: number }[];
    activeSubscriptions: number;
    paidActiveSubscriptions: number;
    complimentaryActiveSubscriptions: number;
    expiredSubscriptions: number;
    autoRenewEnabled: number;
    totalSubscriptionRevenue: number;
};

export interface ReferralStats {
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

export interface AnalyticsStats {
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
