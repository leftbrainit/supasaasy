/**
 * Intercom Connector Types
 *
 * Type definitions specific to the Intercom connector.
 */

// =============================================================================
// Resource Types
// =============================================================================

/**
 * Intercom resource types supported by this connector
 */
export type IntercomResourceType =
  | 'company'
  | 'contact'
  | 'admin'
  | 'conversation'
  | 'conversation_part';

/**
 * Mapping of Intercom resource types to collection keys
 */
export const INTERCOM_COLLECTION_KEYS: Record<IntercomResourceType, string> = {
  company: 'intercom_company',
  contact: 'intercom_contact',
  admin: 'intercom_admin',
  conversation: 'intercom_conversation',
  conversation_part: 'intercom_conversation_part',
};

// =============================================================================
// Webhook Event Types
// =============================================================================

/**
 * Intercom webhook events we handle.
 * Note: Intercom uses different event naming conventions for different resources.
 */
export const INTERCOM_WEBHOOK_EVENTS = {
  // Company events
  'company.created': { resourceType: 'company', eventType: 'create' },
  'company.updated': { resourceType: 'company', eventType: 'update' },

  // Contact/User events (Intercom uses both 'contact' and 'user' prefixes)
  'contact.created': { resourceType: 'contact', eventType: 'create' },
  'contact.updated': { resourceType: 'contact', eventType: 'update' },
  'contact.deleted': { resourceType: 'contact', eventType: 'delete' },
  'contact.user.created': { resourceType: 'contact', eventType: 'create' },
  'contact.user.updated': { resourceType: 'contact', eventType: 'update' },
  'contact.user.deleted': { resourceType: 'contact', eventType: 'delete' },
  'contact.lead.created': { resourceType: 'contact', eventType: 'create' },
  'contact.lead.updated': { resourceType: 'contact', eventType: 'update' },
  'contact.lead.deleted': { resourceType: 'contact', eventType: 'delete' },
  'user.created': { resourceType: 'contact', eventType: 'create' },
  'user.email.updated': { resourceType: 'contact', eventType: 'update' },
  'user.tag.created': { resourceType: 'contact', eventType: 'update' },
  'user.tag.deleted': { resourceType: 'contact', eventType: 'update' },
  'user.deleted': { resourceType: 'contact', eventType: 'delete' },
  'user.unsubscribed': { resourceType: 'contact', eventType: 'update' },

  // Conversation events
  'conversation.created': { resourceType: 'conversation', eventType: 'create' },
  'conversation.read': { resourceType: 'conversation', eventType: 'update' },
  'conversation.user.created': { resourceType: 'conversation', eventType: 'create' },
  'conversation.user.replied': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.single.created': { resourceType: 'conversation', eventType: 'create' },
  'conversation.admin.replied': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.assigned': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.open.assigned': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.closed': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.opened': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.snoozed': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.unsnoozed': { resourceType: 'conversation', eventType: 'update' },
  'conversation.admin.noted': { resourceType: 'conversation', eventType: 'update' },
  'conversation.rating.added': { resourceType: 'conversation', eventType: 'update' },
  'conversation.rating.remarked': { resourceType: 'conversation', eventType: 'update' },
  'conversation.part.tag.created': { resourceType: 'conversation', eventType: 'update' },
  // Note: Admin resources don't have webhooks in Intercom
} as const;

export type IntercomWebhookEventType = keyof typeof INTERCOM_WEBHOOK_EVENTS;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Intercom-specific app configuration
 */
export interface IntercomAppConfig {
  /** Environment variable name for the API key (Access Token) */
  api_key_env?: string;
  /** Environment variable name for the webhook signing secret (Client Secret) */
  webhook_secret_env?: string;
  /** Direct API key (not recommended for production) */
  api_key?: string;
  /** Direct webhook secret (not recommended for production) */
  webhook_secret?: string;
  /** Resource types to sync (defaults to all) */
  sync_resources?: IntercomResourceType[];
  /**
   * Optional minimum timestamp for historical data sync (ISO 8601 string).
   * When set, full sync will only fetch records created on or after this date.
   */
  sync_from?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Intercom API pagination structure (cursor-based)
 */
export interface IntercomPaginatedResponse<T> {
  type: 'list';
  data: T[];
  total_count?: number;
  pages?: {
    type: 'pages';
    page?: number;
    per_page?: number;
    total_pages?: number;
    next?: {
      page?: number;
      starting_after?: string;
    };
  };
}

/**
 * Intercom Company list response (uses scroll-based pagination)
 * Note: The Companies endpoint uses a different pagination strategy than other endpoints.
 * It returns a scroll_param that must be passed to /companies/scroll for the next page.
 */
export interface IntercomCompanyListResponse {
  type: 'company.list';
  data: IntercomCompany[];
  total_count?: number;
  /** Scroll parameter for fetching the next page of results */
  scroll_param?: string;
}

/**
 * Intercom conversation list response (different from standard pagination)
 */
export interface IntercomConversationListResponse {
  type: 'conversation.list';
  conversations: IntercomConversation[];
  total_count: number;
  pages?: {
    type: 'pages';
    page?: number;
    per_page?: number;
    total_pages?: number;
    next?: {
      page?: number;
      starting_after?: string;
    };
  };
}

/**
 * Intercom Company object from API
 */
export interface IntercomCompany {
  type: 'company';
  id: string;
  company_id?: string;
  name?: string;
  plan?: {
    type: string;
    id: string;
    name: string;
  };
  size?: number;
  website?: string;
  industry?: string;
  monthly_spend?: number;
  session_count?: number;
  user_count?: number;
  remote_created_at?: number;
  created_at: number;
  updated_at: number;
  custom_attributes?: Record<string, unknown>;
}

/**
 * Intercom Contact object from API
 */
export interface IntercomContact {
  type: 'contact';
  id: string;
  workspace_id?: string;
  external_id?: string;
  role: 'user' | 'lead';
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  owner_id?: number;
  social_profiles?: {
    type: 'list';
    data: Array<{
      type: string;
      name: string;
      url: string;
    }>;
  };
  has_hard_bounced?: boolean;
  marked_email_as_spam?: boolean;
  unsubscribed_from_emails?: boolean;
  created_at: number;
  updated_at: number;
  signed_up_at?: number;
  last_seen_at?: number;
  last_replied_at?: number;
  last_contacted_at?: number;
  last_email_opened_at?: number;
  last_email_clicked_at?: number;
  language_override?: string;
  browser?: string;
  browser_language?: string;
  os?: string;
  location?: {
    type: string;
    country?: string;
    region?: string;
    city?: string;
  };
  android_app_name?: string;
  android_app_version?: string;
  android_device?: string;
  android_os_version?: string;
  android_sdk_version?: string;
  android_last_seen_at?: number;
  ios_app_name?: string;
  ios_app_version?: string;
  ios_device?: string;
  ios_os_version?: string;
  ios_sdk_version?: string;
  ios_last_seen_at?: number;
  custom_attributes?: Record<string, unknown>;
  tags?: {
    type: 'list';
    data: Array<{
      type: string;
      id: string;
      name?: string;
    }>;
  };
  notes?: {
    type: 'list';
    data: Array<unknown>;
  };
  companies?: {
    type: 'list';
    data: Array<{
      type: string;
      id: string;
      name?: string;
    }>;
  };
}

/**
 * Intercom Admin object from API
 */
export interface IntercomAdmin {
  type: 'admin';
  id: string;
  name?: string;
  email?: string;
  job_title?: string;
  away_mode_enabled?: boolean;
  away_mode_reassign?: boolean;
  has_inbox_seat?: boolean;
  team_ids?: number[];
  avatar?: {
    type: string;
    image_url?: string;
  };
}

/**
 * Intercom Conversation Part object from API
 */
export interface IntercomConversationPart {
  type: 'conversation_part';
  id: string;
  part_type: string;
  body?: string;
  created_at: number;
  updated_at?: number;
  notified_at?: number;
  assigned_to?: {
    type: string;
    id: string;
  };
  author: {
    type: string;
    id: string;
    name?: string;
    email?: string;
  };
  attachments?: Array<{
    type: string;
    name: string;
    url: string;
    content_type?: string;
    filesize?: number;
    width?: number;
    height?: number;
  }>;
  external_id?: string;
  redacted?: boolean;
}

/**
 * Intercom Conversation object from API
 */
export interface IntercomConversation {
  type: 'conversation';
  id: string;
  title?: string;
  created_at: number;
  updated_at: number;
  waiting_since?: number;
  snoozed_until?: number;
  open: boolean;
  state: 'open' | 'closed' | 'snoozed';
  read?: boolean;
  priority?: 'priority' | 'not_priority';
  admin_assignee_id?: number;
  team_assignee_id?: string;
  tags?: {
    type: 'list';
    tags: Array<{
      type: string;
      id: string;
      name?: string;
    }>;
  };
  conversation_rating?: {
    rating: number;
    remark?: string;
    created_at?: number;
    contact?: {
      type: string;
      id: string;
    };
    teammate?: {
      type: string;
      id: string;
    };
  };
  source?: {
    type: string;
    id: string;
    delivered_as: string;
    subject?: string;
    body?: string;
    author: {
      type: string;
      id: string;
      name?: string;
      email?: string;
    };
    attachments?: Array<unknown>;
    url?: string;
    redacted?: boolean;
  };
  contacts?: {
    type: 'list';
    contacts: Array<{
      type: string;
      id: string;
    }>;
  };
  teammates?: {
    type: 'list';
    teammates: Array<{
      type: string;
      id: string;
    }>;
  };
  first_contact_reply?: {
    created_at?: number;
    type?: string;
    url?: string;
  };
  sla_applied?: {
    type: string;
    sla_name?: string;
    sla_status?: string;
  };
  statistics?: {
    type: string;
    time_to_assignment?: number;
    time_to_admin_reply?: number;
    time_to_first_close?: number;
    time_to_last_close?: number;
    median_time_to_reply?: number;
    first_contact_reply_at?: number;
    first_assignment_at?: number;
    first_admin_reply_at?: number;
    first_close_at?: number;
    last_assignment_at?: number;
    last_assignment_admin_reply_at?: number;
    last_contact_reply_at?: number;
    last_admin_reply_at?: number;
    last_close_at?: number;
    last_closed_by_id?: string;
    count_reopens?: number;
    count_assignments?: number;
    count_conversation_parts?: number;
  };
  conversation_parts?: {
    type: 'list';
    conversation_parts: IntercomConversationPart[];
  };
  custom_attributes?: Record<string, unknown>;
}

/**
 * Intercom webhook payload structure
 */
export interface IntercomWebhookPayload {
  type: 'notification_event';
  topic: string;
  id: string;
  app_id?: string;
  data: {
    type: 'notification_event_data';
    item: Record<string, unknown>;
  };
  links?: Record<string, unknown>;
  delivery_attempts?: number;
  first_sent_at?: number;
  created_at?: number;
  self?: string;
}

/**
 * Intercom search query structure
 */
export interface IntercomSearchQuery {
  query: {
    field?: string;
    operator?: '>' | '<' | '=' | '~' | '!=' | 'IN' | 'NIN';
    value?: string | number;
  };
  pagination?: {
    per_page?: number;
    starting_after?: string;
  };
}

/**
 * Intercom search response structure (same as conversation list)
 */
export interface IntercomSearchResponse<T> {
  type: 'conversation.list';
  conversations: T[];
  total_count: number;
  pages?: {
    type: 'pages';
    page?: number;
    per_page?: number;
    total_pages?: number;
    next?: {
      page?: number;
      starting_after?: string;
    };
  };
}
