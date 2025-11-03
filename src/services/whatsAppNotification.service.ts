import axios, { AxiosResponse } from 'axios';
import { WhatsAppMessageTemplates } from "../common/WhatsAppMessageTemplates";

// ==================== INTERFACES & TYPES ====================

export interface WhatsAppConfig {
  whatsappApiUrl?: string;
  accessToken: string;
  phoneNumberId: string;
} 
 
export interface MessageOptions {
  preview_url?: boolean;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  phoneNumber?: string;
  template?: string;
  error?: string;
}

export interface MediaMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface Analytics {
  messagesSent: number;
  messagesFailed: number;
  totalCalls: number;
  successRate: string;
  availableTemplates: TemplateInfo[];
}

export interface TemplateInfo {
  key: string;
  category: string;
  requiresApproval: boolean;
}

// ==================== BOOKING INTERFACES ====================

export interface User {
  id?: string;
  name: string;
  phone: string;
  preferences?: UserPreferences;
}

export interface Agent {
  id?: string;
  name: string;
  phone: string;
  specialty?: string;
}

export interface Property {
  id?: string;
  name: string;
  address?: string;
  location?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
}

export interface Booking {
  id: string;
  dateTime: Date | string;
  userId?: string;
  propertyId?: string;
  agentId?: string;
  propertyName?: string;
  userPreferences?: string;
  status?: string;
}

export interface BookingData {
  booking: Booking;
  user: User;
  agent: Agent;
  property: Property;
}

export interface CancellationData {
  booking: Booking;
  user: User;
  agent: Agent;
  reason?: string;
}

export interface RescheduleData {
  booking: Booking;
  user: User;
  agent: Agent;
  oldDateTime: Date | string;
  newDateTime: Date | string;
  reason?: string;
}

export interface ReminderData {
  booking: Booking;
  user: User;
  agent: Agent;
  property: Property;
}

// ==================== PROPERTY INTERFACES ====================

export interface UserPreferences {
  propertyType?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  amenities?: string[];
}

export interface PropertyMatch {
  name: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  matchScore?: number;
}

export interface MatchData {
  user: User;
  matchedProperties: PropertyMatch[];
}

export interface ListingData {
  user: User;
  property: Property & { matchScore?: number };
  matchScore?: number;
}

export interface PriceDropData {
  user: User;
  property: Property;
  oldPrice: number;
  newPrice: number;
}

export interface PreferencesData {
  user: User;
  preferences: UserPreferences;
}

// ==================== AGENT & COMMUNICATION INTERFACES ====================

export interface AssignmentData {
  user: User;
  agent: Agent;
  property?: Property;
  reason?: string;
}

export interface FollowUpData {
  user: User;
  daysSinceLastActivity: number;
}

// ==================== BROADCAST INTERFACES ====================

export interface BroadcastUser {
  id: string;
  name: string;
  phone: string;
  customVariables?: Record<string, any>;
}

export interface BroadcastData {
  users: BroadcastUser[];
  templateKey: string;
  variables?: Record<string, any>;
  delayBetweenMessages?: number;
}

export interface BroadcastResult {
  success: boolean;
  totalUsers: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    userId: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export interface NotificationResults {
  success: boolean;
  results: Array<{
    type: 'user' | 'agent';
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  error?: string;
}

// ==================== WHATSAPP API INTERFACES ====================

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'video' | 'audio';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  image?: {
    link: string;
    caption?: string;
  };
  document?: {
    link: string;
    caption?: string;
  };
  video?: {
    link: string;
    caption?: string;
  };
  audio?: {
    link: string;
  };
}

export interface WhatsAppApiResponse {
  messages: Array<{
    id: string;
  }>;
}

// ==================== MAIN SERVICE CLASS ====================

class WhatsAppNotificationService {
  private whatsappApiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  private templates: WhatsAppMessageTemplates;
  private analytics: {
    messagesSent: number;
    messagesFailed: number;
    totalCalls: number;
  };

  constructor(config: WhatsAppConfig) {
    this.whatsappApiUrl = config.whatsappApiUrl || 'https://graph.facebook.com/v22.0';
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    
    // Initialize components
    this.templates = new WhatsAppMessageTemplates();
    this.analytics = {
      messagesSent: 0,
      messagesFailed: 0,
      totalCalls: 0
    };
  }

  // ==================== CORE MESSAGING METHOD ====================

  /**
   * Send WhatsApp message using template
   */
  async sendMessage(
    phoneNumber: string, 
    templateKey: string, 
    variables: Record<string, any> = {}, 
    options: MessageOptions = {}
  ): Promise<MessageResult> {
    try {
      this.analytics.totalCalls++;
      
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Generate message from template
      const messageContent = this.templates.generateMessage(templateKey, variables);
      if (!messageContent) {
        throw new Error(`Template ${templateKey} not found`);
      }

      // Prepare WhatsApp API payload
      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: {
          body: messageContent,
          preview_url: options.preview_url || false
        }
      };

      // Send message via WhatsApp Business API
      const response: AxiosResponse<WhatsAppApiResponse> = await axios.post(
        `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      this.analytics.messagesSent++;
      
      return {
        success: true,
        messageId: response.data.messages[0].id,
        phoneNumber: formattedPhone,
        template: templateKey
      };

    } catch (error: any) {
      this.analytics.messagesFailed++;
      
      return {
        success: false,
        error: error.message,
        phoneNumber,
        template: templateKey
      };
    }
  }

  /**
   * Send message with media attachment
   */
  async sendMediaMessage(
    phoneNumber: string, 
    mediaType: 'image' | 'document' | 'video' | 'audio', 
    mediaUrl: string, 
    caption: string = ''
  ): Promise<MediaMessageResult> {
    try {
      this.analytics.totalCalls++;
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          caption: caption
        }
      }; 

      const response: AxiosResponse<WhatsAppApiResponse> = await axios.post(
        `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      this.analytics.messagesSent++;
      return { success: true, messageId: response.data.messages[0].id };

    } catch (error: any) {
      this.analytics.messagesFailed++;
      return { success: false, error: error.message };
    }
  }

  // ==================== BOOKING NOTIFICATION METHODS ====================

  /**
   * Send booking confirmation to user and agent
   */
  async sendBookingConfirmation(bookingData: BookingData): Promise<NotificationResults> {
    const { booking, user, agent, property } = bookingData;
    const results: Array<{type: 'user' | 'agent'; success: boolean; messageId?: string; error?: string}> = [];

    try { 
      // Send confirmation to user
      const userResult = await this.sendMessage(user.phone, 'booking_confirmation', {
        userName: user.name,
        propertyName: property.name,
        propertyAddress: property.address,
        date: this.formatDate(booking.dateTime),
        time: this.formatTime(booking.dateTime),
        agentName: agent.name,
        agentPhone: agent.phone,
        bookingId: booking.id
      });
      results.push({ type: 'user', ...userResult });

      // Send notification to agent
      const agentResult = await this.sendMessage(agent.phone, 'agent_new_booking', {
        agentName: agent.name,
        userName: user.name,
        userPhone: user.phone,
        propertyName: property.name,
        propertyAddress: property.address,
        date: this.formatDate(booking.dateTime),
        time: this.formatTime(booking.dateTime),
        bookingId: booking.id,
        userPreferences: booking.userPreferences || 'No specific preferences'
      });
      results.push({ type: 'agent', ...agentResult });

      return { success: true, results };

    } catch (error: any) {
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Send booking cancellation notification
   */
  async sendBookingCancellation(cancellationData: CancellationData): Promise<NotificationResults> {
    const { booking, user, agent, reason } = cancellationData;
    const results: Array<{type: 'user' | 'agent'; success: boolean; messageId?: string; error?: string}> = [];

    try {
      // Notify user
      const userResult = await this.sendMessage(user.phone, 'booking_cancelled', {
        userName: user.name,
        propertyName: booking.propertyName,
        date: this.formatDate(booking.dateTime),
        cancellationReason: reason || 'No specific reason provided'
      });
      results.push({ type: 'user', ...userResult });

      // Notify agent
      const agentResult = await this.sendMessage(agent.phone, 'booking_cancelled_agent', {
        agentName: agent.name,
        userName: user.name,
        propertyName: booking.propertyName,
        date: this.formatDate(booking.dateTime),
        reason: reason
      });
      results.push({ type: 'agent', ...agentResult });

      return { success: true, results };

    } catch (error: any) {
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Send booking reschedule notification
   */
  async sendBookingReschedule(rescheduleData: RescheduleData): Promise<MessageResult> {
    const { booking, user, agent, oldDateTime, newDateTime, reason } = rescheduleData;

    try {
      const result = await this.sendMessage(user.phone, 'booking_rescheduled', {
        userName: user.name,
        propertyName: booking.propertyName,
        oldDate: this.formatDate(oldDateTime),
        oldTime: this.formatTime(oldDateTime),
        newDate: this.formatDate(newDateTime),
        newTime: this.formatTime(newDateTime),
        agentName: agent.name,
        rescheduleReason: reason || 'Schedule adjustment'
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send viewing reminder (call this method when you want to send reminders)
   */
  async sendViewingReminder(
    reminderData: ReminderData, 
    reminderType: '24h' | '2h' = '24h'
  ): Promise<MessageResult> {
    const { booking, user, agent, property } = reminderData;
    
    const templateKey = reminderType === '2h' ? 'viewing_reminder_2h' : 'viewing_reminder_24h';
    
    try {
      const result = await this.sendMessage(user.phone, templateKey, {
        userName: user.name,
        propertyName: property.name,
        propertyAddress: property.address,
        date: this.formatDate(booking.dateTime),
        time: this.formatTime(booking.dateTime),
        agentName: agent.name,
        agentPhone: agent.phone
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== PROPERTY MATCHING METHODS ====================

  /**
   * Send property match notifications
   */
  async sendPropertyMatches(matchData: MatchData): Promise<MessageResult> {
    const { user, matchedProperties } = matchData;
    
    // Format property list for WhatsApp
    const propertyList = matchedProperties
      .slice(0, 3) // Limit to top 3 matches
      .map((prop, index) => 
        `${index + 1}. *${prop.name}*\n` +
        `   📍 ${prop.location}\n` +
        `   💰 ${this.formatCurrency(prop.price)}\n` +
        `   🛏️ ${prop.bedrooms} bed, ${prop.bathrooms} bath\n` +
        `   ⭐ Match: ${Math.round((prop.matchScore || 0.8) * 100)}%`
      ).join('\n\n');

    try {
      const result = await this.sendMessage(user.phone, 'property_matches', {
        userName: user.name,
        matchCount: matchedProperties.length,
        propertyList: propertyList,
        bookingLink: `${process.env.APP_URL}/book?userId=${user.id}`,
        morePropertiesLink: matchedProperties.length > 3 ? 
          `\n\n🔍 *View all matches:* ${process.env.APP_URL}/properties?userId=${user.id}` : ''
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new listing notification
   */
  async sendNewListingAlert(listingData: ListingData): Promise<MessageResult> {
    const { user, property, matchScore } = listingData;

    try {
      const result = await this.sendMessage(user.phone, 'new_listing_match', {
        userName: user.name,
        propertyDetails: `🏠 *${property.name}*\n📍 ${property.location}\n💰 ${this.formatCurrency(property.price || 0)}\n🛏️ ${property.bedrooms} bed, ${property.bathrooms} bath`,
        matchScore: Math.round((matchScore || 0.85) * 100),
        bookingLink: `${process.env.APP_URL}/book?propertyId=${property.id}&userId=${user.id}`
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send price drop notification
   */
  async sendPriceDropAlert(priceDropData: PriceDropData): Promise<MessageResult> {
    const { user, property, oldPrice, newPrice } = priceDropData;
    const savings = oldPrice - newPrice;

    try {
      const result = await this.sendMessage(user.phone, 'price_drop_alert', {
        userName: user.name,
        propertyName: property.name,
        propertyLocation: property.location,
        oldPrice: this.formatCurrency(oldPrice),
        newPrice: this.formatCurrency(newPrice),
        savings: this.formatCurrency(savings),
        bookingLink: `${process.env.APP_URL}/book?propertyId=${property.id}&userId=${user.id}`
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== USER PREFERENCE METHODS ====================

  /**
   * Send preferences saved confirmation
   */
  async sendPreferencesSaved(preferencesData: PreferencesData): Promise<MessageResult> {
    const { user, preferences } = preferencesData;

    try {
      const result = await this.sendMessage(user.phone, 'preferences_saved', {
        userName: user.name,
        preferencesSummary: this.formatPreferences(preferences)
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send preferences updated confirmation
   */
  async sendPreferencesUpdated(updateData: PreferencesData): Promise<MessageResult> {
    const { user, preferences } = updateData;

    try {
      const result = await this.sendMessage(user.phone, 'preferences_updated', {
        userName: user.name,
        preferencesSummary: this.formatPreferences(preferences)
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== AGENT COMMUNICATION METHODS ====================

  /**
   * Send agent assignment notification
   */
  async sendAgentAssignment(assignmentData: AssignmentData): Promise<NotificationResults> {
    const { user, agent, property, reason } = assignmentData;
    const results: Array<{type: 'user' | 'agent'; success: boolean; messageId?: string; error?: string}> = [];

    try {
      // Notify user about their new agent
      const userResult = await this.sendMessage(user.phone, 'agent_assigned', {
        userName: user.name,
        agentName: agent.name,
        agentPhone: agent.phone,
        agentSpecialty: agent.specialty || 'Property Sales',
        propertyName: property?.name || 'your property search',
        reason: reason || 'expertise match'
      });
      results.push({ type: 'user', ...userResult });

      // Notify agent about new client
      const agentResult = await this.sendMessage(agent.phone, 'client_assigned', {
        agentName: agent.name,
        userName: user.name,
        userPhone: user.phone,
        userPreferences: this.formatPreferences(user.preferences || {}),
        assignmentReason: reason || 'client needs match'
      });
      results.push({ type: 'agent', ...agentResult });

      return { success: true, results };

    } catch (error: any) {
      return { success: false, error: error.message, results };
    }
  }

  // ==================== FOLLOW-UP METHODS ====================

  /**
   * Send follow-up message to inactive users
   */
  async sendFollowUpMessage(followUpData: FollowUpData): Promise<MessageResult> {
    const { user, daysSinceLastActivity } = followUpData;

    try {
      const result = await this.sendMessage(user.phone, 'follow_up_reminder', {
        userName: user.name,
        daysSince: daysSinceLastActivity,
        searchLink: `${process.env.APP_URL}/search?userId=${user.id}`
      });

      return result;

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== BROADCAST METHODS ====================

  /**
   * Send broadcast message to multiple users
   */
  async sendBroadcast(broadcastData: BroadcastData): Promise<BroadcastResult> {
    const { users, templateKey, variables = {}, delayBetweenMessages = 1000 } = broadcastData;
    const results: Array<{
      userId: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    for (const user of users) {
      try {
        const userVariables = {
          ...variables,
          userName: user.name,
          ...user.customVariables
        };

        const result = await this.sendMessage(user.phone, templateKey, userVariables);
        results.push({ userId: user.id, ...result });

        // Delay to avoid rate limiting
        if (delayBetweenMessages > 0) {
          await this.delay(delayBetweenMessages);
        }

      } catch (error: any) {
        results.push({ 
          userId: user.id, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      totalUsers: users.length,
      successCount,
      failureCount: users.length - successCount,
      results
    };
  }

  // ==================== UTILITY METHODS ====================

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `1${cleaned}`;
    }
    return cleaned;
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  private formatPreferences(preferences: UserPreferences): string {
    const parts: string[] = [];
    if (preferences.propertyType) parts.push(`${preferences.propertyType}s`);
    if (preferences.minBedrooms) parts.push(`${preferences.minBedrooms}+ bedrooms`);
    if (preferences.location) parts.push(`in ${preferences.location}`);
    if (preferences.maxPrice) parts.push(`under ${this.formatCurrency(preferences.maxPrice)}`);
    
    return parts.join(', ') || 'your preferences';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== ANALYTICS & ADMIN ====================

  public getAnalytics(): Analytics {
    return {
      messagesSent: this.analytics.messagesSent,
      messagesFailed: this.analytics.messagesFailed,
      totalCalls: this.analytics.totalCalls,
      successRate: this.analytics.totalCalls > 0 ? 
        ((this.analytics.messagesSent / this.analytics.totalCalls) * 100).toFixed(2) + '%' : '0%',
      availableTemplates: this.templates.getTemplateList()
    };
  }

  /**
   * Test method to verify service is working
   */
  async testConnection(testPhone: string): Promise<MessageResult> {
    try {
      const result = await this.sendMessage(testPhone, 'test_message', {
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export default WhatsAppNotificationService;