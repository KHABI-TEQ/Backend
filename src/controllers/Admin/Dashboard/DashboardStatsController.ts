import { Response } from "express";
import { DashboardStatsService, DateRange, TimeFilter } from "../../../services/dashboardStats";
import { AppRequest } from "../../../types/express";

export class DashboardStatsController {
  private statsService: DashboardStatsService;

  constructor() {
    this.statsService = new DashboardStatsService();
  }

  /**
   * Get dashboard statistics
   * @route GET /api/dashboard/stats
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter (ISO format)
   * @query {string} endDate - End date for range filter (ISO format)
   */
  getStats = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "365days", startDate, endDate } = req.query;

      // Validate filter
      const validFilters: TimeFilter[] = ["7days", "30days", "365days", "range"];
      if (!validFilters.includes(filter as TimeFilter)) {
        res.status(400).json({
          success: false,
          message: `Invalid filter. Must be one of: ${validFilters.join(", ")}`
        });
        return;
      }

      // Prepare date range for custom filter
      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }

        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };

        // Validate dates
        if (isNaN(customRange.startDate.getTime()) || isNaN(customRange.endDate.getTime())) {
          res.status(400).json({
            success: false,
            message: "Invalid date format. Use ISO format (YYYY-MM-DD)"
          });
          return;
        }

        if (customRange.startDate > customRange.endDate) {
          res.status(400).json({
            success: false,
            message: "startDate cannot be after endDate"
          });
          return;
        }
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Dashboard statistics retrieved successfully",
        data: {
          filter,
          ...(customRange && { dateRange: customRange }),
          stats
        }
      });
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve comparison data",
        error: error.message
      });
    }
  };


    /**
     * Get dashboard statistics
     * @route GET /api/dashboard/stats/:statsType
     * @query {string} filter - Time filter: 7days, 30days, 365days, range
     * @query {string} startDate - Start date for range filter (ISO format)
     * @query {string} endDate - End date for range filter (ISO format)
     */
    getStatsByType = async (req: AppRequest, res: Response): Promise<void> => {
    try {
        const { statsType } = req.params;
        const { filter = "365days", startDate, endDate } = req.query;

        // ✅ Validate filter
        const validFilters: TimeFilter[] = ["7days", "30days", "90days", "365days", "range"];
        if (!validFilters.includes(filter as TimeFilter)) {
        res.status(400).json({
            success: false,
            message: `Invalid filter. Must be one of: ${validFilters.join(", ")}`
        });
        return;
        }

        // ✅ Prepare date range for "range" filter
        let customRange: DateRange | undefined;
        if (filter === "range") {
        if (!startDate || !endDate) {
            res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
            });
            return;
        }

        customRange = {
            startDate: new Date(startDate as string),
            endDate: new Date(endDate as string)
        };

        // Validate dates
        if (isNaN(customRange.startDate.getTime()) || isNaN(customRange.endDate.getTime())) {
            res.status(400).json({
            success: false,
            message: "Invalid date format. Use ISO format (YYYY-MM-DD)"
            });
            return;
        }

        if (customRange.startDate > customRange.endDate) {
            res.status(400).json({
            success: false,
            message: "startDate cannot be after endDate"
            });
            return;
        }
        }

        // ✅ Select stats by type
        let stats;
        switch (statsType) {
        case "overview":
            stats = await this.statsService.getOverviewStats(filter as TimeFilter, customRange);
            break;

        case "properties":
            stats = await this.statsService.getPropertyStats(filter as TimeFilter, customRange);
            break;

        case "users":
            stats = await this.statsService.getUserStats(filter as TimeFilter, customRange);
            break;

        case "transactions":
            stats = await this.statsService.getTransactionStats(filter as TimeFilter, customRange);
            break;

        case "bookings":
            stats = await this.statsService.getBookingStats(filter as TimeFilter, customRange);
            break;

        case "inspections":
            stats = await this.statsService.getInspectionStats(filter as TimeFilter, customRange);
            break;

        case "subscriptions":
            stats = await this.statsService.getAgentSubscriptionStats(filter as TimeFilter, customRange);
            break;

        case "preferences":
            stats = await this.statsService.getPreferenceStats(filter as TimeFilter, customRange);
            break;

        case "referrals":
            stats = await this.statsService.getReferralStats(filter as TimeFilter, customRange);
            break;

        case "analytics":
            stats = await this.statsService.getAnalyticsStats(filter as TimeFilter, customRange);
            break;

        default:
            res.status(400).json({
            success: false,
            message: `Invalid statsType: ${statsType}`,
            });
            return;
        }

        // ✅ Send response
        res.status(200).json({
        success: true,
        message: "Dashboard statistics retrieved successfully",
        data: {
            statsType,
            filter,
            ...(customRange && { dateRange: customRange }),
            stats,
        },
        });
    } catch (error: any) {
        console.error("❌ Error fetching dashboard stats:", error);
        res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard statistics",
        error: error.message,
        });
    }
    };


  /**
   * Export dashboard data
   * @route GET /api/dashboard/stats/export
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} format - Export format: json, csv
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  exportData = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", format = "json", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      if (format === "csv") {
        // Convert to CSV format
        const csvData = this.convertToCSV(stats);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=dashboard-stats-${filter}.csv`);
        res.status(200).send(csvData);
      } else {
        // Return as JSON
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=dashboard-stats-${filter}.json`);
        res.status(200).json(stats);
      }
    } catch (error: any) {
      console.error("Error exporting data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export data",
        error: error.message
      });
    }
  };

  private convertToCSV(data: any): string {
    // Simple CSV conversion for overview stats
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Properties", data.overview.totalProperties],
      ["Total Preferences", data.overview.totalPreferences],
      ["Total Transactions", data.overview.totalTransactions],
      ["Total Revenue", data.overview.totalRevenue],
      ["Total Users", data.overview.totalUsers],
      ["Active Listings", data.overview.activeListings],
      ["Pending Approvals", data.overview.pendingApprovals],
      ["Matched Preferences", data.overview.matchedPreferences]
    ];

    let csv = headers.join(",") + "\n";
    rows.forEach(row => {
      csv += row.join(",") + "\n";
    });

    return csv;
  }

  /**
   * Get overview statistics only
   * @route GET /api/dashboard/stats/overview
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getOverview = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Overview statistics retrieved successfully",
        data: {
          filter,
          overview: stats.overview
        }
      });
    } catch (error: any) {
      console.error("Error fetching overview stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve overview statistics",
        error: error.message
      });
    }
  };

  /**
   * Get analytics for charts and graphs
   * @route GET /api/dashboard/analytics
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getAnalytics = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Analytics data retrieved successfully",
        data: {
          filter,
          analytics: stats.analytics
        }
      });
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics data",
        error: error.message
      });
    }
  };

  /**
   * Get property statistics
   * @route GET /api/dashboard/stats/properties
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getPropertyStats = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Property statistics retrieved successfully",
        data: {
          filter,
          propertyStats: stats.propertyStats
        }
      });
    } catch (error: any) {
      console.error("Error fetching property stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve property statistics",
        error: error.message
      });
    }
  };

  /**
   * Get transaction statistics
   * @route GET /api/dashboard/stats/transactions
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getTransactionStats = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Transaction statistics retrieved successfully",
        data: {
          filter,
          transactionStats: stats.transactionStats
        }
      });
    } catch (error: any) {
      console.error("Error fetching transaction stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve transaction statistics",
        error: error.message
      });
    }
  };

  /**
   * Get user statistics
   * @route GET /api/dashboard/stats/users
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getUserStats = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "User statistics retrieved successfully",
        data: {
          filter,
          userStats: stats.userStats
        }
      });
    } catch (error: any) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user statistics",
        error: error.message
      });
    }
  };

  /**
   * Get preference statistics
   * @route GET /api/dashboard/stats/preferences
   * @query {string} filter - Time filter: 7days, 30days, 365days, range
   * @query {string} startDate - Start date for range filter
   * @query {string} endDate - End date for range filter
   */
  getPreferenceStats = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { filter = "30days", startDate, endDate } = req.query;

      let customRange: DateRange | undefined;
      if (filter === "range") {
        if (!startDate || !endDate) {
          res.status(400).json({
            success: false,
            message: "startDate and endDate are required for range filter"
          });
          return;
        }
        customRange = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const stats = await this.statsService.getStats(filter as TimeFilter, customRange);

      res.status(200).json({
        success: true,
        message: "Preference statistics retrieved successfully",
        data: {
          filter,
          preferenceStats: stats.preferenceStats
        }
      });
    } catch (error: any) {
      console.error("Error fetching preference stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve preference statistics",
        error: error.message
      });
    }
  };

  /**
   * Get comparison between two time periods
   * @route GET /api/dashboard/stats/comparison
   * @query {string} currentFilter - Current time filter
   * @query {string} previousFilter - Previous time filter
   */
  getComparison = async (req: AppRequest, res: Response): Promise<void> => {
    try {
      const { currentFilter = "30days", previousFilter = "30days" } = req.query;

      const validFilters: TimeFilter[] = ["7days", "30days", "365days"];
      
      if (!validFilters.includes(currentFilter as TimeFilter) || 
          !validFilters.includes(previousFilter as TimeFilter)) {
        res.status(400).json({
          success: false,
          message: `Invalid filter. Must be one of: ${validFilters.join(", ")}`
        });
        return;
      }

      const comparison = await this.statsService.getComparison(
        currentFilter as TimeFilter,
        previousFilter as TimeFilter
      );

      res.status(200).json({
        success: true,
        message: "Comparison data retrieved successfully",
        data: {
          currentFilter,
          previousFilter,
          comparison
        }
      });
    } catch (error: any) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve Comparison data",
        error: error.message
      });
    }
};

}