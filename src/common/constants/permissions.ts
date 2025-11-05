export const PERMISSION_CATEGORIES = {
  AGENTS: 'agents',
  PROPERTIES: 'properties',
  LANDLORDS: 'landlords',
  BUYERS: 'buyers',
  INSPECTIONS: 'inspections',
  FIELD_AGENTS: 'field-agents',
  ADMINS: 'admins',
  PREFERENCES: 'preferences',
  PROMOTIONS: 'promotions',
  TRANSACTIONS: 'transactions',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  TESTIMONIALS: 'testimonials',
  SUBSCRIPTIONS: 'subscriptions',
  REFERRALS: 'referrals',
  VERIFICATION: 'verification',
  ADS: 'ads',
  EXTRA_PAGES: 'extra-pages',
  PUBLIC_ACCESS_PAGE: 'public-access-page',
  EMAIL_SUBSCRIPTIONS: 'email-subscriptions',
} as const;


export const PERMISSIONS = {
  // Agents permissions
  AGENTS_VIEW: 'agents.read',
  AGENTS_CREATE: 'agents.create',
  AGENTS_EDIT: 'agents.update',
  AGENTS_DELETE: 'agents.delete',
  AGENTS_APPROVE: 'agents.approve',
  AGENTS_REJECT: 'agents.reject',
  AGENTS_FLAG: 'agents.flag',
  AGENTS_VIEW_KYC: 'agents.view_kyc',
  AGENTS_APPROVE_KYC: 'agents.approve_kyc',
  AGENTS_MANAGE_STATUS: 'agents.manage_status',

  // Properties permissions
  PROPERTIES_VIEW: 'properties.read',
  PROPERTIES_CREATE: 'properties.create',
  PROPERTIES_EDIT: 'properties.update',
  PROPERTIES_DELETE: 'properties.delete',
  PROPERTIES_APPROVE: 'properties.approve',
  PROPERTIES_REJECT: 'properties.reject',
  PROPERTIES_VIEW_DETAILS: 'properties.view_details',

   // Landlords permissions
  LANDLORDS_VIEW: "landlords.read",
  LANDLORDS_CREATE: "landlords.create",
  LANDLORDS_EDIT: "landlords.update",
  LANDLORDS_DELETE: "landlords.delete",
  LANDLORDS_APPROVE: "landlords.approve",
  LANDLORDS_REJECT: "landlords.reject",
  LANDLORDS_FLAG: "landlords.flag",
  LANDLORDS_MANAGE_STATUS: "landlords.manage_status",

  // Buyers permissions
  BUYERS_VIEW: 'buyers.read',
  BUYERS_CREATE: 'buyers.create',
  BUYERS_EDIT: 'buyers.update',
  BUYERS_DELETE: 'buyers.delete',
  BUYERS_VIEW_PREFERENCES: 'buyers.view_preferences',
  BUYERS_MANAGE_PREFERENCES: 'buyers.manage_preferences',

  // Inspections permissions
  INSPECTIONS_VIEW: 'inspections.read',
  INSPECTIONS_CREATE: 'inspections.create',
  INSPECTIONS_EDIT: 'inspections.update',
  INSPECTIONS_DELETE: 'inspections.delete',
  INSPECTIONS_APPROVE: 'inspections.approve',
  INSPECTIONS_REJECT: 'inspections.reject',
  INSPECTIONS_VIEW_DETAILS: 'inspections.view_details',
  INSPECTIONS_ASSIGN_FIELD_AGENT: 'inspections.assign_field_agent',

  // Field Agents permissions
  FIELD_AGENTS_VIEW: 'field-agents.read',
  FIELD_AGENTS_CREATE: 'field-agents.create',
  FIELD_AGENTS_EDIT: 'field-agents.update',
  FIELD_AGENTS_DELETE: 'field-agents.delete',
  FIELD_AGENTS_ASSIGN_INSPECTION: 'field-agents.assign_inspection',
  FIELD_AGENTS_VIEW_INSPECTIONS: 'field-agents.view_inspections',
  FIELD_AGENTS_MANAGE_STATUS: 'field-agents.manage_status',

  // Admin management permissions
  ADMINS_VIEW: 'admins.read',
  ADMINS_CREATE: 'admins.create',
  ADMINS_EDIT: 'admins.update',
  ADMINS_DELETE: 'admins.delete',
  ADMINS_ASSIGN_ROLES: 'admins.assign_roles',
  ADMINS_MANAGE_PERMISSIONS: 'admins.manage_permissions',
  ADMINS_VIEW_ACTIVITY: 'admins.view_activity',

  // Preferences permissions
  PREFERENCES_VIEW: 'preferences.read',
  PREFERENCES_APPROVE: 'preferences.approve',
  PREFERENCES_REJECT: 'preferences.reject',
  PREFERENCES_VIEW_MATCHES: 'preferences.view_matches',
  PREFERENCES_SEND_MATCHES: 'preferences.send_matches',

  EXTRAL_PAGES_VIEW: "extra-pages.read",

  // Public access page permissions
  PUBLIC_ACCESS_PAGE_VIEW: "public-access-page.read",
  PUBLIC_ACCESS_PAGE_APPROVE: "public-access-page.approve",
  PUBLIC_ACCESS_PAGE_REJECT: "public-access-page.reject",

  // Email Subscription permissions
  EMAIL_SUB_VIEW: "email-subscriptions.read",
  EMAIL_SUB_APPROVE: "email-subscriptions.approve",
  EMAIL_SUB_REJECT: "email-subscriptions.reject",

  // Promotions permissions
  PROMOTIONS_VIEW: 'promotions.read',
  PROMOTIONS_CREATE: 'promotions.create',
  PROMOTIONS_EDIT: 'promotions.update',
  PROMOTIONS_DELETE: 'promotions.delete',
  PROMOTIONS_MANAGE_STATUS: 'promotions.manage_status',
  PROMOTIONS_VIEW_ANALYTICS: 'promotions.view_analytics',

  // Transactions permissions
  TRANSACTIONS_VIEW: 'transactions.read',
  TRANSACTIONS_EDIT: 'transactions.update',
  TRANSACTIONS_DELETE: 'transactions.delete',
  TRANSACTIONS_REFUND: 'transactions.refund',
  TRANSACTIONS_VIEW_DETAILS: 'transactions.view_details',

    // Analytics permissions
  ANALYTICS_VIEW_DASHBOARD: "analytics.view_analytics",
  ANALYTICS_VIEW_OVERVIEW: "analytics.view_overview",
  ANALYTICS_VIEW_AGENTS: "analytics.view_agents",
  ANALYTICS_VIEW_USERS: "analytics.view_users",
  ANALYTICS_VIEW_PROPERTIES: "analytics.view_properties",
  ANALYTICS_VIEW_PREFERENCES: "analytics.view_preferences",
  ANALYTICS_VIEW_BUYERS: "analytics.view_buyers",
  ANALYTICS_VIEW_BOOKINGS: "analytics.view_bookings",
  ANALYTICS_VIEW_INSPECTIONS: "analytics.view_inspections",
  ANALYTICS_VIEW_SUBSCRIPTIONS: "analytics.view_subscriptions",
  ANALYTICS_VIEW_REFERRALS: "analytics.view_referrals",
  ANALYTICS_VIEW_TRANSACTIONS: "analytics.view_transactions",
  ANALYTICS_VIEW_FIELD_AGENTS: "analytics.view_field_agents",

  // Settings permissions
  SETTINGS_VIEW: 'settings.read',
  SETTINGS_EDIT: 'settings.update',
  SETTINGS_MANAGE_HOME_SETTINGS: 'settings.manage_home_settings',

  // Testimonials permissions
  TESTIMONIALS_VIEW: 'testimonials.read',
  TESTIMONIALS_CREATE: 'testimonials.create',
  TESTIMONIALS_EDIT: 'testimonials.update',
  TESTIMONIALS_DELETE: 'testimonials.delete',
  TESTIMONIALS_MANAGE_STATUS: 'testimonials.manage_status',

  // Subscriptions permissions
  SUBSCRIPTIONS_VIEW: 'subscriptions.read',
  SUBSCRIPTIONS_CREATE: 'subscriptions.create',
  SUBSCRIPTIONS_EDIT: 'subscriptions.update',
  SUBSCRIPTIONS_DELETE: 'subscriptions.delete',

  // Referrals permissions
  REFERRALS_VIEW: 'referrals.read',
  REFERRALS_EDIT: 'referrals.update',
  REFERRALS_DELETE: 'referrals.delete',

  // Document Verification permissions
  VERIFICATION_VIEW: 'verification.read',
  VERIFICATION_APPROVE: 'verification.approve',
  VERIFICATION_REJECT: 'verification.reject',
  VERIFICATION_SEND_TO_PROVIDER: 'verification.send_to_provider',
  VERIFICATION_DELETE: 'verification.delete',

  // Ads permissions
  ADS_VIEW: 'ads.read',
  ADS_CREATE: 'ads.create',
  ADS_EDIT: 'ads.update',
  ADS_DELETE: 'ads.delete',
  ADS_MANAGE_STATUS: 'ads.manage_status',
  ADS_VIEW_ANALYTICS: 'ads.view_analytics',
} as const;

export const PERMISSION_DESCRIPTIONS = {
  [PERMISSIONS.AGENTS_VIEW]: 'View all agents',
  [PERMISSIONS.AGENTS_CREATE]: 'Create new agents',
  [PERMISSIONS.AGENTS_EDIT]: 'Edit agent details',
  [PERMISSIONS.AGENTS_DELETE]: 'Delete agents',
  [PERMISSIONS.AGENTS_APPROVE]: 'Approve pending agents',
  [PERMISSIONS.AGENTS_REJECT]: 'Reject agent applications',
  [PERMISSIONS.AGENTS_FLAG]: 'Flag agent accounts',
  [PERMISSIONS.AGENTS_VIEW_KYC]: 'View KYC requests from agents',
  [PERMISSIONS.AGENTS_APPROVE_KYC]: 'Approve KYC requests',
  [PERMISSIONS.AGENTS_MANAGE_STATUS]: 'Manage agent account status',

  [PERMISSIONS.PROPERTIES_VIEW]: 'View all properties',
  [PERMISSIONS.PROPERTIES_CREATE]: 'Create new properties',
  [PERMISSIONS.PROPERTIES_EDIT]: 'Edit property details',
  [PERMISSIONS.PROPERTIES_DELETE]: 'Delete properties',
  [PERMISSIONS.PROPERTIES_APPROVE]: 'Approve properties for listing',
  [PERMISSIONS.PROPERTIES_REJECT]: 'Reject property listings',
  [PERMISSIONS.PROPERTIES_VIEW_DETAILS]: 'View detailed property information',

  // Landlords permissions
  [PERMISSIONS.LANDLORDS_VIEW]: "View all landlords",
  [PERMISSIONS.LANDLORDS_CREATE]: "Create new landlords",
  [PERMISSIONS.LANDLORDS_EDIT]: "Edit landlord information",
  [PERMISSIONS.LANDLORDS_DELETE]: "Delete landlords",
  [PERMISSIONS.LANDLORDS_APPROVE]: "Approve landlord accounts",
  [PERMISSIONS.LANDLORDS_REJECT]: "Reject landlord accounts",
  [PERMISSIONS.LANDLORDS_FLAG]: "Flag landlords for review",
  [PERMISSIONS.LANDLORDS_MANAGE_STATUS]: "Manage landlord active/inactive status",

  
  [PERMISSIONS.BUYERS_VIEW]: 'View all buyers',
  [PERMISSIONS.BUYERS_CREATE]: 'Create buyer records',
  [PERMISSIONS.BUYERS_EDIT]: 'Edit buyer information',
  [PERMISSIONS.BUYERS_DELETE]: 'Delete buyer records',
  [PERMISSIONS.BUYERS_VIEW_PREFERENCES]: 'View buyer preferences',
  [PERMISSIONS.BUYERS_MANAGE_PREFERENCES]: 'Manage buyer preferences',

  [PERMISSIONS.INSPECTIONS_VIEW]: 'View all inspections',
  [PERMISSIONS.INSPECTIONS_CREATE]: 'Create inspection records',
  [PERMISSIONS.INSPECTIONS_EDIT]: 'Edit inspection details',
  [PERMISSIONS.INSPECTIONS_DELETE]: 'Delete inspections',
  [PERMISSIONS.INSPECTIONS_APPROVE]: 'Approve inspections',
  [PERMISSIONS.INSPECTIONS_REJECT]: 'Reject inspections',
  [PERMISSIONS.INSPECTIONS_VIEW_DETAILS]: 'View detailed inspection information',
  [PERMISSIONS.INSPECTIONS_ASSIGN_FIELD_AGENT]: 'Assign field agents to inspections',

  [PERMISSIONS.FIELD_AGENTS_VIEW]: 'View all field agents',
  [PERMISSIONS.FIELD_AGENTS_CREATE]: 'Create field agent accounts',
  [PERMISSIONS.FIELD_AGENTS_EDIT]: 'Edit field agent information',
  [PERMISSIONS.FIELD_AGENTS_DELETE]: 'Delete field agent accounts',
  [PERMISSIONS.FIELD_AGENTS_ASSIGN_INSPECTION]: 'Assign inspections to field agents',
  [PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS]: 'View field agent assigned inspections',
  [PERMISSIONS.FIELD_AGENTS_MANAGE_STATUS]: 'Manage field agent status',

  [PERMISSIONS.ADMINS_VIEW]: 'View admin users',
  [PERMISSIONS.ADMINS_CREATE]: 'Create admin accounts',
  [PERMISSIONS.ADMINS_EDIT]: 'Edit admin information',
  [PERMISSIONS.ADMINS_DELETE]: 'Delete admin accounts',
  [PERMISSIONS.ADMINS_ASSIGN_ROLES]: 'Assign roles to admins',
  [PERMISSIONS.ADMINS_MANAGE_PERMISSIONS]: 'Manage admin permissions',
  [PERMISSIONS.ADMINS_VIEW_ACTIVITY]: 'View admin activity logs',

  [PERMISSIONS.PREFERENCES_VIEW]: 'View buyer/tenant/developer preferences',
  [PERMISSIONS.PREFERENCES_APPROVE]: 'Approve preference records',
  [PERMISSIONS.PREFERENCES_REJECT]: 'Reject preferences',
  [PERMISSIONS.PREFERENCES_VIEW_MATCHES]: 'View matched properties for preferences',
  [PERMISSIONS.PREFERENCES_SEND_MATCHES]: 'Send property matches to users',

  // Extra pages permissions
  [PERMISSIONS.EXTRAL_PAGES_VIEW]: "View extra CMS pages",

  // Public access page permissions
  [PERMISSIONS.PUBLIC_ACCESS_PAGE_VIEW]: "View public access pages",
  [PERMISSIONS.PUBLIC_ACCESS_PAGE_APPROVE]: "Approve public access page",
  [PERMISSIONS.PUBLIC_ACCESS_PAGE_REJECT]: "Reject public access page",

  // Email Subscription permissions
  [PERMISSIONS.EMAIL_SUB_VIEW]: "View email subscription list",
  [PERMISSIONS.EMAIL_SUB_APPROVE]: "Approve email subscription",
  [PERMISSIONS.EMAIL_SUB_REJECT]: "Reject email subscription",


  [PERMISSIONS.PROMOTIONS_VIEW]: 'View all promotions',
  [PERMISSIONS.PROMOTIONS_CREATE]: 'Create new promotions',
  [PERMISSIONS.PROMOTIONS_EDIT]: 'Edit promotion details',
  [PERMISSIONS.PROMOTIONS_DELETE]: 'Delete promotions',
  [PERMISSIONS.PROMOTIONS_MANAGE_STATUS]: 'Manage promotion status',
  [PERMISSIONS.PROMOTIONS_VIEW_ANALYTICS]: 'View promotion analytics',

  [PERMISSIONS.TRANSACTIONS_VIEW]: 'View all transactions',
  [PERMISSIONS.TRANSACTIONS_EDIT]: 'Edit transaction details',
  [PERMISSIONS.TRANSACTIONS_DELETE]: 'Delete transactions',
  [PERMISSIONS.TRANSACTIONS_REFUND]: 'Process transaction refunds',
  [PERMISSIONS.TRANSACTIONS_VIEW_DETAILS]: 'View detailed transaction information',

  // Analytics permissions
  [PERMISSIONS.ANALYTICS_VIEW_DASHBOARD]: "View main analytics dashboard",
  [PERMISSIONS.ANALYTICS_VIEW_OVERVIEW]: "View analytics overview",
  [PERMISSIONS.ANALYTICS_VIEW_AGENTS]: "View analytics for agents",
  [PERMISSIONS.ANALYTICS_VIEW_USERS]: "View analytics for users",
  [PERMISSIONS.ANALYTICS_VIEW_PROPERTIES]: "View analytics for properties",
  [PERMISSIONS.ANALYTICS_VIEW_PREFERENCES]: "View analytics for preferences",
  [PERMISSIONS.ANALYTICS_VIEW_BUYERS]: "View analytics for buyers",
  [PERMISSIONS.ANALYTICS_VIEW_BOOKINGS]: "View analytics for bookings",
  [PERMISSIONS.ANALYTICS_VIEW_INSPECTIONS]: "View analytics for inspections",
  [PERMISSIONS.ANALYTICS_VIEW_SUBSCRIPTIONS]: "View analytics for subscriptions",
  [PERMISSIONS.ANALYTICS_VIEW_REFERRALS]: "View analytics for referrals",
  [PERMISSIONS.ANALYTICS_VIEW_TRANSACTIONS]: "View analytics for transactions",
  [PERMISSIONS.ANALYTICS_VIEW_FIELD_AGENTS]: "View analytics for field agents",

  [PERMISSIONS.SETTINGS_VIEW]: 'View system settings',
  [PERMISSIONS.SETTINGS_EDIT]: 'Modify system settings',
  [PERMISSIONS.SETTINGS_MANAGE_HOME_SETTINGS]: 'Manage home page settings',

  [PERMISSIONS.TESTIMONIALS_VIEW]: 'View testimonials',
  [PERMISSIONS.TESTIMONIALS_CREATE]: 'Create testimonials',
  [PERMISSIONS.TESTIMONIALS_EDIT]: 'Edit testimonials',
  [PERMISSIONS.TESTIMONIALS_DELETE]: 'Delete testimonials',
  [PERMISSIONS.TESTIMONIALS_MANAGE_STATUS]: 'Manage testimonial status',

  [PERMISSIONS.SUBSCRIPTIONS_VIEW]: 'View subscription plans',
  [PERMISSIONS.SUBSCRIPTIONS_CREATE]: 'Create subscription plans',
  [PERMISSIONS.SUBSCRIPTIONS_EDIT]: 'Edit subscription plans',
  [PERMISSIONS.SUBSCRIPTIONS_DELETE]: 'Delete subscription plans',

  [PERMISSIONS.REFERRALS_VIEW]: 'View referral logs',
  [PERMISSIONS.REFERRALS_EDIT]: 'Edit referral information',
  [PERMISSIONS.REFERRALS_DELETE]: 'Delete referrals',

  [PERMISSIONS.VERIFICATION_VIEW]: 'View verification documents',
  [PERMISSIONS.VERIFICATION_APPROVE]: 'Approve document verification',
  [PERMISSIONS.VERIFICATION_REJECT]: 'Reject document verification',
  [PERMISSIONS.VERIFICATION_SEND_TO_PROVIDER]: 'Send documents to verification provider',
  [PERMISSIONS.VERIFICATION_DELETE]: 'Delete verification records',

  [PERMISSIONS.ADS_VIEW]: 'View advertisements',
  [PERMISSIONS.ADS_CREATE]: 'Create advertisements',
  [PERMISSIONS.ADS_EDIT]: 'Edit advertisements',
  [PERMISSIONS.ADS_DELETE]: 'Delete advertisements',
  [PERMISSIONS.ADS_MANAGE_STATUS]: 'Manage advertisement status',
  [PERMISSIONS.ADS_VIEW_ANALYTICS]: 'View advertisement analytics',
} as const;

// Role definitions with default permissions
export const DEFAULT_ROLES = {
  SUPER_ADMIN: {
    name: 'superAdmin',
    description: 'Full system access with all permissions',
    level: 1,
    permissions: Object.values(PERMISSIONS),
  },
  ADMIN: {
    name: 'admin',
    description: 'Administrative access with most permissions',
    level: 2,
    permissions: [
      // Agents
      PERMISSIONS.AGENTS_VIEW,
      PERMISSIONS.AGENTS_CREATE,
      PERMISSIONS.AGENTS_EDIT,
      PERMISSIONS.AGENTS_DELETE,
      PERMISSIONS.AGENTS_APPROVE,
      PERMISSIONS.AGENTS_REJECT,
      PERMISSIONS.AGENTS_FLAG,
      PERMISSIONS.AGENTS_VIEW_KYC,
      PERMISSIONS.AGENTS_APPROVE_KYC,
      PERMISSIONS.AGENTS_MANAGE_STATUS,

      // Properties
      PERMISSIONS.PROPERTIES_VIEW,
      PERMISSIONS.PROPERTIES_CREATE,
      PERMISSIONS.PROPERTIES_EDIT,
      PERMISSIONS.PROPERTIES_DELETE,
      PERMISSIONS.PROPERTIES_APPROVE,
      PERMISSIONS.PROPERTIES_REJECT,
      PERMISSIONS.PROPERTIES_VIEW_DETAILS,

      // Buyers
      PERMISSIONS.BUYERS_VIEW,
      PERMISSIONS.BUYERS_CREATE,
      PERMISSIONS.BUYERS_EDIT,
      PERMISSIONS.BUYERS_DELETE,
      PERMISSIONS.BUYERS_VIEW_PREFERENCES,
      PERMISSIONS.BUYERS_MANAGE_PREFERENCES,

      // Inspections
      PERMISSIONS.INSPECTIONS_VIEW,
      PERMISSIONS.INSPECTIONS_CREATE,
      PERMISSIONS.INSPECTIONS_EDIT,
      PERMISSIONS.INSPECTIONS_DELETE,
      PERMISSIONS.INSPECTIONS_APPROVE,
      PERMISSIONS.INSPECTIONS_REJECT,
      PERMISSIONS.INSPECTIONS_VIEW_DETAILS,
      PERMISSIONS.INSPECTIONS_ASSIGN_FIELD_AGENT,

      // Field Agents
      PERMISSIONS.FIELD_AGENTS_VIEW,
      PERMISSIONS.FIELD_AGENTS_CREATE,
      PERMISSIONS.FIELD_AGENTS_EDIT,
      PERMISSIONS.FIELD_AGENTS_DELETE,
      PERMISSIONS.FIELD_AGENTS_ASSIGN_INSPECTION,
      PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS,
      PERMISSIONS.FIELD_AGENTS_MANAGE_STATUS,

      // Preferences
      PERMISSIONS.PREFERENCES_VIEW,
      PERMISSIONS.PREFERENCES_APPROVE,
      PERMISSIONS.PREFERENCES_REJECT,
      PERMISSIONS.PREFERENCES_VIEW_MATCHES,
      PERMISSIONS.PREFERENCES_SEND_MATCHES,

      // Promotions
      PERMISSIONS.PROMOTIONS_VIEW,
      PERMISSIONS.PROMOTIONS_CREATE,
      PERMISSIONS.PROMOTIONS_EDIT,
      PERMISSIONS.PROMOTIONS_DELETE,
      PERMISSIONS.PROMOTIONS_MANAGE_STATUS,
      PERMISSIONS.PROMOTIONS_VIEW_ANALYTICS,

      // Transactions
      PERMISSIONS.TRANSACTIONS_VIEW,
      PERMISSIONS.TRANSACTIONS_EDIT,
      PERMISSIONS.TRANSACTIONS_DELETE,
      PERMISSIONS.TRANSACTIONS_REFUND,
      PERMISSIONS.TRANSACTIONS_VIEW_DETAILS,

      // Analytics
      PERMISSIONS.ANALYTICS_VIEW_DASHBOARD,
      PERMISSIONS.ANALYTICS_VIEW_AGENTS,
      PERMISSIONS.ANALYTICS_VIEW_PROPERTIES,
      PERMISSIONS.ANALYTICS_VIEW_BUYERS,
      PERMISSIONS.ANALYTICS_VIEW_INSPECTIONS,
      PERMISSIONS.ANALYTICS_VIEW_TRANSACTIONS,
      PERMISSIONS.ANALYTICS_VIEW_FIELD_AGENTS,

      // Settings
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_EDIT,
      PERMISSIONS.SETTINGS_MANAGE_HOME_SETTINGS,

      // Testimonials
      PERMISSIONS.TESTIMONIALS_VIEW,
      PERMISSIONS.TESTIMONIALS_CREATE,
      PERMISSIONS.TESTIMONIALS_EDIT,
      PERMISSIONS.TESTIMONIALS_DELETE,
      PERMISSIONS.TESTIMONIALS_MANAGE_STATUS,

      // Subscriptions
      PERMISSIONS.SUBSCRIPTIONS_VIEW,
      PERMISSIONS.SUBSCRIPTIONS_CREATE,
      PERMISSIONS.SUBSCRIPTIONS_EDIT,
      PERMISSIONS.SUBSCRIPTIONS_DELETE,

      // Referrals
      PERMISSIONS.REFERRALS_VIEW,
      PERMISSIONS.REFERRALS_EDIT,
      PERMISSIONS.REFERRALS_DELETE,

      // Verification
      PERMISSIONS.VERIFICATION_VIEW,
      PERMISSIONS.VERIFICATION_APPROVE,
      PERMISSIONS.VERIFICATION_REJECT,
      PERMISSIONS.VERIFICATION_SEND_TO_PROVIDER,
      PERMISSIONS.VERIFICATION_DELETE,

      // Ads
      PERMISSIONS.ADS_VIEW,
      PERMISSIONS.ADS_CREATE,
      PERMISSIONS.ADS_EDIT,
      PERMISSIONS.ADS_DELETE,
      PERMISSIONS.ADS_MANAGE_STATUS,
      PERMISSIONS.ADS_VIEW_ANALYTICS,
    ],
  },
  MANAGER: {
    name: 'manager',
    description: 'Manager with limited administrative permissions',
    level: 3,
    permissions: [
      // Agents - read only except approve/reject
      PERMISSIONS.AGENTS_VIEW,
      PERMISSIONS.AGENTS_APPROVE,
      PERMISSIONS.AGENTS_REJECT,
      PERMISSIONS.AGENTS_VIEW_KYC,
      PERMISSIONS.AGENTS_APPROVE_KYC,

      // Properties - read only except approve/reject
      PERMISSIONS.PROPERTIES_VIEW,
      PERMISSIONS.PROPERTIES_APPROVE,
      PERMISSIONS.PROPERTIES_REJECT,
      PERMISSIONS.PROPERTIES_VIEW_DETAILS,

      // Buyers
      PERMISSIONS.BUYERS_VIEW,
      PERMISSIONS.BUYERS_VIEW_PREFERENCES,

      // Inspections
      PERMISSIONS.INSPECTIONS_VIEW,
      PERMISSIONS.INSPECTIONS_APPROVE,
      PERMISSIONS.INSPECTIONS_REJECT,
      PERMISSIONS.INSPECTIONS_VIEW_DETAILS,
      PERMISSIONS.INSPECTIONS_ASSIGN_FIELD_AGENT,

      // Field Agents
      PERMISSIONS.FIELD_AGENTS_VIEW,
      PERMISSIONS.FIELD_AGENTS_ASSIGN_INSPECTION,
      PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS,

      // Preferences
      PERMISSIONS.PREFERENCES_VIEW,
      PERMISSIONS.PREFERENCES_APPROVE,
      PERMISSIONS.PREFERENCES_REJECT,
      PERMISSIONS.PREFERENCES_VIEW_MATCHES,

      // Promotions - read only
      PERMISSIONS.PROMOTIONS_VIEW,
      PERMISSIONS.PROMOTIONS_VIEW_ANALYTICS,

      // Transactions
      PERMISSIONS.TRANSACTIONS_VIEW,
      PERMISSIONS.TRANSACTIONS_VIEW_DETAILS,

      // Analytics
      PERMISSIONS.ANALYTICS_VIEW_DASHBOARD,
      PERMISSIONS.ANALYTICS_VIEW_AGENTS,
      PERMISSIONS.ANALYTICS_VIEW_PROPERTIES,
      PERMISSIONS.ANALYTICS_VIEW_BUYERS,
      PERMISSIONS.ANALYTICS_VIEW_INSPECTIONS,
      PERMISSIONS.ANALYTICS_VIEW_TRANSACTIONS,

      // Testimonials
      PERMISSIONS.TESTIMONIALS_VIEW,

      // Verification
      PERMISSIONS.VERIFICATION_VIEW,
      PERMISSIONS.VERIFICATION_APPROVE,
      PERMISSIONS.VERIFICATION_REJECT,
    ],
  },
  VIEWER: {
    name: 'viewer',
    description: 'Read-only access to all dashboards and reports',
    level: 4,
    permissions: [
      // All view/read permissions only
      PERMISSIONS.AGENTS_VIEW,
      PERMISSIONS.PROPERTIES_VIEW,
      PERMISSIONS.PROPERTIES_VIEW_DETAILS,
      PERMISSIONS.BUYERS_VIEW,
      PERMISSIONS.BUYERS_VIEW_PREFERENCES,
      PERMISSIONS.INSPECTIONS_VIEW,
      PERMISSIONS.INSPECTIONS_VIEW_DETAILS,
      PERMISSIONS.FIELD_AGENTS_VIEW,
      PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS,
      PERMISSIONS.PREFERENCES_VIEW,
      PERMISSIONS.PREFERENCES_VIEW_MATCHES,
      PERMISSIONS.PROMOTIONS_VIEW,
      PERMISSIONS.PROMOTIONS_VIEW_ANALYTICS,
      PERMISSIONS.TRANSACTIONS_VIEW,
      PERMISSIONS.TRANSACTIONS_VIEW_DETAILS,
      PERMISSIONS.ANALYTICS_VIEW_DASHBOARD,
      PERMISSIONS.ANALYTICS_VIEW_AGENTS,
      PERMISSIONS.ANALYTICS_VIEW_PROPERTIES,
      PERMISSIONS.ANALYTICS_VIEW_BUYERS,
      PERMISSIONS.ANALYTICS_VIEW_INSPECTIONS,
      PERMISSIONS.ANALYTICS_VIEW_TRANSACTIONS,
      PERMISSIONS.ANALYTICS_VIEW_FIELD_AGENTS,
      PERMISSIONS.TESTIMONIALS_VIEW,
      PERMISSIONS.SUBSCRIPTIONS_VIEW,
      PERMISSIONS.REFERRALS_VIEW,
      PERMISSIONS.VERIFICATION_VIEW,
      PERMISSIONS.ADS_VIEW,
    ],
  },
  AGENT_REVIEWER: {
    name: 'agent-reviewer',
    description: 'Agent approval and KYC review specialist',
    level: 3,
    permissions: [
      PERMISSIONS.AGENTS_VIEW,
      PERMISSIONS.AGENTS_VIEW_KYC,
      PERMISSIONS.AGENTS_APPROVE_KYC,
      PERMISSIONS.AGENTS_APPROVE,
      PERMISSIONS.AGENTS_REJECT,
      PERMISSIONS.AGENTS_MANAGE_STATUS,
      PERMISSIONS.ANALYTICS_VIEW_AGENTS,
    ],
  },
  PROPERTY_REVIEWER: {
    name: 'property-reviewer',
    description: 'Property approval and listing specialist',
    level: 3,
    permissions: [
      PERMISSIONS.PROPERTIES_VIEW,
      PERMISSIONS.PROPERTIES_VIEW_DETAILS,
      PERMISSIONS.PROPERTIES_APPROVE,
      PERMISSIONS.PROPERTIES_REJECT,
      PERMISSIONS.ANALYTICS_VIEW_PROPERTIES,
    ],
  },
  INSPECTOR: {
    name: 'inspector',
    description: 'Inspection management and approval',
    level: 3,
    permissions: [
      PERMISSIONS.INSPECTIONS_VIEW,
      PERMISSIONS.INSPECTIONS_VIEW_DETAILS,
      PERMISSIONS.INSPECTIONS_APPROVE,
      PERMISSIONS.INSPECTIONS_REJECT,
      PERMISSIONS.INSPECTIONS_ASSIGN_FIELD_AGENT,
      PERMISSIONS.FIELD_AGENTS_VIEW,
      PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS,
      PERMISSIONS.ANALYTICS_VIEW_INSPECTIONS,
    ],
  },
  FIELD_AGENT_MANAGER: {
    name: 'field-agent-manager',
    description: 'Field agent management and assignment',
    level: 3,
    permissions: [
      PERMISSIONS.FIELD_AGENTS_VIEW,
      PERMISSIONS.FIELD_AGENTS_CREATE,
      PERMISSIONS.FIELD_AGENTS_EDIT,
      PERMISSIONS.FIELD_AGENTS_ASSIGN_INSPECTION,
      PERMISSIONS.FIELD_AGENTS_VIEW_INSPECTIONS,
      PERMISSIONS.FIELD_AGENTS_MANAGE_STATUS,
      PERMISSIONS.INSPECTIONS_VIEW,
      PERMISSIONS.INSPECTIONS_VIEW_DETAILS,
      PERMISSIONS.ANALYTICS_VIEW_FIELD_AGENTS,
    ],
  },
} as const;
