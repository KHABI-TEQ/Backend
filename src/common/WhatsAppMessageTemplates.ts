export interface Template {
  template: string;
  category: 'booking' | 'agent' | 'reminder' | 'preferences' | 'matching' | 'followup' | 'system' | 'custom';
  requiresApproval: boolean;
  createdAt?: string;
}
 
export interface TemplateInfo {
  key: string;
  category: string;
  requiresApproval: boolean;
} 
 
export interface TemplateData {
  template: string;
  category?: string;
  requiresApproval?: boolean;
}

export class WhatsAppMessageTemplates {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // ==================== BOOKING TEMPLATES ====================
    
    this.templates.set('booking_confirmation', {
      template: `🏠 *Booking Confirmed!*

Hi {{userName}},

Your property viewing is confirmed:

📍 *Property:* {{propertyName}}
🏡 *Address:* {{propertyAddress}}
📅 *Date:* {{date}}
⏰ *Time:* {{time}}
👨‍💼 *Agent:* {{agentName}}
📞 *Agent Phone:* {{agentPhone}}

🆔 *Booking ID:* {{bookingId}}

We're excited to show you this property! 🎉

_Please arrive 5 minutes early and bring a valid ID._`,
      category: 'preferences',
      requiresApproval: false
    });

    this.templates.set('preferences_updated', {
      template: `🔄 *Preferences Updated*

Hi {{userName}},

Your preferences have been updated:

🎯 *Now looking for:* {{preferencesSummary}}

We're already searching for new matches! 🔍`,
      category: 'preferences',
      requiresApproval: false
    });

    // ==================== PROPERTY MATCH TEMPLATES ====================

    this.templates.set('property_matches', {
      template: `🎯 *Perfect Matches Found!*

Hi {{userName}},

We found {{matchCount}} properties matching your preferences:

{{propertyList}}

Interested in viewing any of these? 

📅 *Book a viewing:* {{bookingLink}}{{morePropertiesLink}}

Act fast - great properties don't last long! ⚡`,
      category: 'matching',
      requiresApproval: false
    });

    this.templates.set('new_listing_match', {
      template: `🆕 *New Listing - Perfect Match!*

Hi {{userName}},

A new property just hit the market that matches your preferences perfectly!

{{propertyDetails}}

⭐ *Match Score:* {{matchScore}}%

This one won't last long. Book a viewing now! 

📅 {{bookingLink}}`,
      category: 'matching',
      requiresApproval: false
    });

    this.templates.set('price_drop_alert', {
      template: `💰 *Price Drop Alert!*

Hi {{userName}},

Great news! A property you showed interest in just reduced its price:

🏠 *Property:* {{propertyName}}
📍 {{propertyLocation}}
💸 *Was:* {{oldPrice}} → *Now:* {{newPrice}}
💰 *You save:* {{savings}}

This is your chance! Book a viewing before someone else does.

📅 {{bookingLink}}`,
      category: 'matching',
      requiresApproval: false
    });

    // ==================== AGENT TEMPLATES ====================

    this.templates.set('agent_assigned', {
      template: `👨‍💼 *Your Personal Agent*

Hi {{userName}},

Meet your dedicated property agent:

👤 *{{agentName}}*
📞 {{agentPhone}}
🏆 *Specialty:* {{agentSpecialty}}

{{agentName}} has been assigned to help you with {{propertyName}} based on {{reason}}.

They'll be in touch shortly to discuss your needs! 🤝`,
      category: 'agent',
      requiresApproval: false
    });

    this.templates.set('client_assigned', {
      template: `👤 *New Client Assignment*

Hi {{agentName}},

You've been assigned a new client:

👤 *Client:* {{userName}}
📞 *Phone:* {{userPhone}}
🎯 *Looking for:* {{userPreferences}}
💼 *Assignment Reason:* {{assignmentReason}}

Please reach out within 24 hours to introduce yourself and schedule an initial consultation.

Good luck! 🤝`,
      category: 'agent',
      requiresApproval: false
    });

    // ==================== FOLLOW-UP TEMPLATES ====================

    this.templates.set('follow_up_reminder', {
      template: `👋 *We miss you!*

Hi {{userName}},

It's been {{daysSince}} days since your last property search. 

🏡 New listings matching your criteria are available!

Ready to find your dream home?

🔍 *Continue searching:* {{searchLink}}`,
      category: 'followup',
      requiresApproval: false
    });

    // ==================== SYSTEM TEMPLATES ====================

    this.templates.set('test_message', {
      template: `🧪 *Test Message*

WhatsApp Notification Service is working!

Timestamp: {{timestamp}}

✅ Connection successful!`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('welcome_message', {
      template: `🎉 *Welcome to PropertyFinder!*

Hi {{userName}},

Thanks for joining us! We're here to help you find the perfect property.

Here's what you can do:
• Set your preferences
• Get instant property matches
• Book viewings with agents
• Receive price alerts

Let's find your dream home! 🏡`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('admin_provisioned_account', {
      template: `🏠 *Khabi-Teq — your account is ready*

Hi {{firstName}},

An administrator created your *{{userType}}* account.

📧 Email: {{email}}
🔗 Sign in: {{loginUrl}}

You must *change your password* after first sign-in. Your temporary password was sent by email.

_If you did not expect this message, contact support._`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('property_created_by_admin', {
      template: `📋 *New listing on your account*

Hi {{firstName}},

An administrator added a property listing for you on Khabi-Teq.

{{summaryLine}}

Open the app to review details.`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('maintenance_notice', {
      template: `🔧 *System Maintenance*

Hi {{userName}},

We'll be performing scheduled maintenance:

📅 *Date:* {{maintenanceDate}}
⏰ *Time:* {{maintenanceTime}}
⌛ *Duration:* {{estimatedDuration}}

Our service will be temporarily unavailable during this time.

Thanks for your patience! 🙏`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('property_inquiry', {
      template: `🏠 *Property Inquiry Received*

Hi {{agentName}},

A client has inquired about one of your properties:

👤 *Client:* {{userName}}
📞 *Phone:* {{userPhone}}
🏠 *Property:* {{propertyName}}
📍 *Location:* {{propertyLocation}}

*Inquiry:* {{inquiryMessage}}

Please respond within 2 hours for best results! ⚡`,
      category: 'agent',
      requiresApproval: false
    });

    this.templates.set('viewing_completed', {
      template: `✅ *Viewing Completed*

Hi {{userName}},

Thank you for viewing {{propertyName}} today!

How did it go? We'd love to hear your thoughts:

• Did you like the property?
• Any questions about the area?
• Ready to make an offer?

Your agent {{agentName}} is ready to help with next steps! 

📞 {{agentPhone}}`,
      category: 'followup',
      requiresApproval: false
    });

    this.templates.set('offer_submitted', {
      template: `📝 *Offer Submitted*

Hi {{userName}},

Your offer has been submitted successfully!

🏠 *Property:* {{propertyName}}
💰 *Offer Amount:* {{offerAmount}}
📅 *Submitted:* {{submissionDate}}

We'll notify you as soon as we hear back from the seller.

Fingers crossed! 🤞`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('offer_accepted', {
      template: `🎉 *CONGRATULATIONS!*

Hi {{userName}},

Your offer has been ACCEPTED! 

🏠 *Property:* {{propertyName}}
💰 *Accepted Amount:* {{acceptedAmount}}
📍 *Address:* {{propertyAddress}}

Your agent {{agentName}} will contact you shortly to discuss next steps.

Welcome to your new home! 🏡✨`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('offer_rejected', {
      template: `😔 *Offer Update*

Hi {{userName}},

Unfortunately, your offer for {{propertyName}} was not accepted this time.

💰 *Your offer:* {{offerAmount}}
💭 *Seller feedback:* {{sellerFeedback}}

Don't give up! Your agent {{agentName}} has some great alternatives to show you.

The perfect home is still out there! 🏡`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('market_update', {
      template: `📈 *Market Update for {{location}}*

Hi {{userName}},

Here's what's happening in your area:

📊 *Average Price:* {{averagePrice}}
📈 *Price Trend:* {{priceTrend}}
🏠 *New Listings:* {{newListings}} this week
⚡ *Market Activity:* {{marketActivity}}

{{marketInsight}}

Stay informed with {{agentName}}! 📞 {{agentPhone}}`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('document_request', {
      template: `📄 *Document Request*

Hi {{userName}},

To proceed with your {{propertyName}} transaction, we need:

{{documentList}}

Please upload or send these documents to {{agentName}}:
📞 {{agentPhone}}
📧 {{agentEmail}}

Time sensitive - please submit within {{deadline}}! ⏰`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('inspection_scheduled', {
      template: `🔍 *Home Inspection Scheduled*

Hi {{userName}},

Your home inspection is confirmed:

🏠 *Property:* {{propertyName}}
👨‍🔧 *Inspector:* {{inspectorName}}
📞 *Inspector Phone:* {{inspectorPhone}}
📅 *Date:* {{inspectionDate}}
⏰ *Time:* {{inspectionTime}}
⏱️ *Duration:* {{estimatedDuration}}

You're welcome to attend! Your agent {{agentName}} will be there.`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('mortgage_reminder', {
      template: `💰 *Mortgage Application Reminder*

Hi {{userName}},

Don't forget to complete your mortgage application for {{propertyName}}.

🏦 *Recommended Lenders:*
{{lenderList}}

⏰ *Pre-approval deadline:* {{deadline}}

Need help? Your agent {{agentName}} can connect you with trusted lenders.

📞 {{agentPhone}}`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('closing_date', {
      template: `🎯 *Closing Date Confirmed*

Hi {{userName}},

Your closing date is set!

🏠 *Property:* {{propertyName}}
📅 *Closing Date:* {{closingDate}}
⏰ *Time:* {{closingTime}}
📍 *Location:* {{closingLocation}}

Final walk-through: {{walkThroughDate}}

Almost there! 🎉`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('welcome_new_homeowner', {
      template: `🎉 *CONGRATULATIONS!* 🎉

Hi {{userName}},

Welcome to homeownership! 

🏡 You are now the proud owner of {{propertyName}}!

🔑 *Keys collected:* ✅
📋 *Documents filed:* ✅
🎊 *Dreams achieved:* ✅

Thank you for trusting {{agentName}} with this journey.

Enjoy your new home! 🥳`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('birthday_message', {
      template: `🎂 *Happy Birthday!* 🎉

Hi {{userName}},

Wishing you a fantastic birthday!

Hope your new home at {{propertyName}} is treating you well.

Have a wonderful celebration! 🎈

Best wishes,
{{agentName}} & the PropertyFinder Team`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('anniversary_message', {
      template: `🎊 *Happy Home Anniversary!*

Hi {{userName}},

It's been {{yearsInHome}} year(s) since you moved into {{propertyName}}!

Time flies when you're loving where you live! 

How has your home ownership journey been? We'd love to hear from you.

{{agentName}} & PropertyFinder Team 🏡`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('referral_request', {
      template: `🌟 *Love Your Experience?*

Hi {{userName}},

We're so glad we could help you find {{propertyName}}!

Know someone looking for their dream home? 

Refer them to {{agentName}} and you'll both receive {{referralBonus}}!

Just have them mention your name. 

Thanks for spreading the word! 🏡💝`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('market_alert', {
      template: `🚨 *Market Alert!*

Hi {{userName}},

{{alertType}} in {{location}}:

{{alertMessage}}

This could affect your property value or search criteria.

Want to discuss? Contact {{agentName}}:
📞 {{agentPhone}}

Stay informed, stay ahead! 📈`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('seasonal_tips', {
      template: `🍂 *{{season}} Home Tips*

Hi {{userName}},

{{season}} is here! Here are some tips for {{propertyName}}:

{{seasonalTips}}

Need maintenance recommendations? {{agentName}} has trusted contractors:
📞 {{agentPhone}}

Keep your home in perfect condition! 🏡✨`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('emergency_contact', {
      template: `🚨 *Emergency Contact Info*

Hi {{userName}},

For your records - important contacts for {{propertyName}}:

🚰 *Water:* {{waterEmergency}}
⚡ *Electricity:* {{electricEmergency}}
🔥 *Gas:* {{gasEmergency}}
👷 *General Maintenance:* {{maintenanceContact}}

Your agent: {{agentName}} ({{agentPhone}})

Save this message! 📱`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('payment_reminder', {
      template: `💳 *Payment Reminder*

Hi {{userName}},

Friendly reminder: {{paymentType}} payment for {{propertyName}} is due on {{dueDate}}.

💰 *Amount:* {{paymentAmount}}
📅 *Due:* {{dueDate}}
💳 *Pay online:* {{paymentLink}}

Questions? Contact {{agentName}}: {{agentPhone}}

Thank you! 🏡`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('survey_request', {
      template: `📋 *Quick Survey - 2 Minutes*

Hi {{userName}},

How was your experience with {{agentName}}?

Your feedback helps us improve!

⭐ *Rate your experience:* {{surveyLink}}

As a thank you, you'll be entered to win {{surveyIncentive}}!

Thank you for your time! 🙏`,
      category: 'system',
      requiresApproval: false
    });

    this.templates.set('promotional_message', {
      template: `🎯 *{{promotionTitle}}*

Hi {{userName}},

{{promotionDetails}}

Perfect for properties in {{preferredLocation}} with your budget of {{budget}}!

⏰ *Valid until:* {{validUntil}}

Contact {{agentName}} now: {{agentPhone}}

Don't miss out! 🏃‍♂️💨`,
      category: 'system',
      requiresApproval: false
    });





    this.templates.set('agent_new_booking', {
      template: `📋 *New Booking Alert*

Hello {{agentName}},

You have a new viewing scheduled:

👤 *Client:* {{userName}}
📱 *Phone:* {{userPhone}}
🏠 *Property:* {{propertyName}}
📍 *Address:* {{propertyAddress}}
📅 *Date & Time:* {{date}} at {{time}}

🎯 *Client Preferences:* {{userPreferences}}

🆔 *Booking ID:* {{bookingId}}

Please prepare for the visit! 💼`,
      category: 'agent',
      requiresApproval: false
    });

    this.templates.set('viewing_reminder_24h', {
      template: `⏰ *Viewing Reminder - Tomorrow*

Hi {{userName}},

Don't forget your property viewing tomorrow:

🏠 *Property:* {{propertyName}}
📍 *Address:* {{propertyAddress}}  
📅 *Tomorrow* at {{time}}
👨‍💼 *Agent:* {{agentName}} ({{agentPhone}})

Please bring:
• Valid photo ID
• Any questions you have
• Arrive 5 minutes early

Looking forward to seeing you! 🎉`,
      category: 'reminder',
      requiresApproval: false
    });

    this.templates.set('viewing_reminder_2h', {
      template: `🚨 *Viewing in 2 Hours!*

Hi {{userName}},

Your property viewing is in 2 hours:

🏠 {{propertyName}}
⏰ Today at {{time}}
👨‍💼 {{agentName}} ({{agentPhone}})

See you soon! 🎯`,
      category: 'reminder',
      requiresApproval: false
    });

    this.templates.set('booking_cancelled', {
      template: `❌ *Booking Cancelled*

Hi {{userName}},

Your viewing for {{propertyName}} on {{date}} has been cancelled.

{{cancellationReason}}

Would you like to reschedule? We're here to help! 

Reply or call us anytime. 📞`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('booking_rescheduled', {
      template: `📅 *Booking Rescheduled*

Hi {{userName}},

Your viewing has been rescheduled:

🏠 *Property:* {{propertyName}}
📅 *New Date:* {{newDate}}
⏰ *New Time:* {{newTime}}
👨‍💼 *Agent:* {{agentName}}

{{rescheduleReason}}

See you then! 🎉`,
      category: 'booking',
      requiresApproval: false
    });

    this.templates.set('booking_cancelled_agent', {
      template: `❌ *Booking Cancelled*

Hi {{agentName}},

A client booking has been cancelled:

👤 *Client:* {{userName}}
🏠 *Property:* {{propertyName}}
📅 *Was scheduled for:* {{date}}

*Reason:* {{reason}}

Please update your calendar accordingly. 📅`,
      category: 'agent',
      requiresApproval: false
    });

    // ==================== PREFERENCES TEMPLATES ====================

    this.templates.set('preferences_saved', {
      template: `✅ *Preferences Saved!*

Hi {{userName}},

Your property preferences have been saved:

🎯 *Looking for:* {{preferencesSummary}}

We'll notify you immediately when matching properties become available!

You can update your preferences anytime through our app. 📱`,
      category: 'agent',
      requiresApproval: false
    });
  }

  /**
   * Generate message from template with variable substitution
   */
  public generateMessage(templateKey: string, variables: Record<string, any> = {}): string | null {
    const template = this.templates.get(templateKey);
    if (!template) {
      return null;
    }

    let message = template.template;
    
    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, String(value || ''));
    }

    // Clean up any remaining unreplaced variables
    message = message.replace(/{{.*?}}/g, '[Missing Value]');
    
    return message;
  }

  /**
   * Get template by key
   */
  public getTemplate(templateKey: string): Template | undefined {
    return this.templates.get(templateKey);
  }

  /**
   * Add or update a template
   */
  public setTemplate(templateKey: string, templateData: TemplateData): void {
    this.templates.set(templateKey, {
      template: templateData.template,
      category: templateData.category as any || 'custom',
      requiresApproval: templateData.requiresApproval || false,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Get all available templates
   */
  public getTemplateList(): TemplateInfo[] {
    const templates: TemplateInfo[] = [];
    for (const [key, template] of this.templates) {
      templates.push({
        key,
        category: template.category,
        requiresApproval: template.requiresApproval
      });
    }
    return templates;
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: Template['category']): Array<{ key: string } & Template> {
    const templates: Array<{ key: string } & Template> = [];
    for (const [key, template] of this.templates) {
      if (template.category === category) {
        templates.push({ key, ...template });
      }
    }
    return templates;
  }

  /**
   * Check if template exists
   */
  public hasTemplate(templateKey: string): boolean {
    return this.templates.has(templateKey);
  }

  /**
   * Delete a template
   */
  public deleteTemplate(templateKey: string): boolean {
    return this.templates.delete(templateKey);
  }

  /**
   * Get all template categories
   */
  public getCategories(): string[] {
    const categories = new Set<string>();
    for (const [, template] of this.templates) {
      categories.add(template.category);
    }
    return Array.from(categories);
  }

  /**
   * Get template count by category
   */
  public getTemplateCount(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [, template] of this.templates) {
      counts[template.category] = (counts[template.category] || 0) + 1;
    }
    return counts;
  }

  /**
   * Validate template variables
   */
  public validateTemplate(templateKey: string, variables: Record<string, any>): {
    isValid: boolean;
    missingVariables: string[];
    extraVariables: string[];
  } {
    const template = this.templates.get(templateKey);
    if (!template) {
      return {
        isValid: false,
        missingVariables: [],
        extraVariables: []
      };
    }

    // Extract required variables from template
    const requiredVars = new Set<string>();
    const regex = /{{(\w+)}}/g;
    let match;
    while ((match = regex.exec(template.template)) !== null) {
      requiredVars.add(match[1]);
    }

    const providedVars = new Set(Object.keys(variables));
    
    const missingVariables = Array.from(requiredVars).filter(v => !providedVars.has(v));
    const extraVariables = Array.from(providedVars).filter(v => !requiredVars.has(v));

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
      extraVariables
    };
  }
}