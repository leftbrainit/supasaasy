/**
 * Intercom Mock Data Generators
 *
 * Creates mock API response data for testing.
 */

import type {
  IntercomAdmin,
  IntercomCompany,
  IntercomContact,
  IntercomConversation,
  IntercomConversationPart,
  IntercomResourceType,
  IntercomWebhookPayload,
} from '../types.ts';

// =============================================================================
// Timestamp Helpers
// =============================================================================

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function pastTimestamp(daysAgo: number): number {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return Math.floor(date.getTime() / 1000);
}

// =============================================================================
// Mock Data Generators
// =============================================================================

export interface MockCompanyOptions {
  id?: string;
  company_id?: string;
  name?: string;
  industry?: string;
  size?: number;
  website?: string;
  created_at?: number;
  updated_at?: number;
}

export function createMockCompany(options: MockCompanyOptions = {}): IntercomCompany {
  const now = nowTimestamp();
  const {
    id = `company_${randomId()}`,
    company_id = `ext_${randomId(8)}`,
    name = 'Test Company',
    industry = 'Technology',
    size = 50,
    website = 'https://example.com',
    created_at = now,
    updated_at = now,
  } = options;

  return {
    type: 'company',
    id,
    company_id,
    name,
    industry,
    size,
    website,
    created_at,
    updated_at,
  };
}

export interface MockContactOptions {
  id?: string;
  external_id?: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: 'user' | 'lead';
  created_at?: number;
  updated_at?: number;
}

export function createMockContact(options: MockContactOptions = {}): IntercomContact {
  const now = nowTimestamp();
  const {
    id = `contact_${randomId()}`,
    external_id,
    email = 'test@example.com',
    name = 'Test Contact',
    phone,
    role = 'user',
    created_at = now,
    updated_at = now,
  } = options;

  return {
    type: 'contact',
    id,
    external_id,
    email,
    name,
    phone,
    role,
    created_at,
    updated_at,
  };
}

export interface MockAdminOptions {
  id?: string;
  email?: string;
  name?: string;
  job_title?: string;
  has_inbox_seat?: boolean;
}

export function createMockAdmin(options: MockAdminOptions = {}): IntercomAdmin {
  const {
    id = `admin_${randomId()}`,
    email = 'admin@example.com',
    name = 'Test Admin',
    job_title = 'Support Agent',
    has_inbox_seat = true,
  } = options;

  return {
    type: 'admin',
    id,
    email,
    name,
    job_title,
    has_inbox_seat,
  };
}

export interface MockConversationPartOptions {
  id?: string;
  conversation_id?: string;
  part_type?: string;
  body?: string;
  author_type?: string;
  author_id?: string;
  author_name?: string;
  created_at?: number;
}

export function createMockConversationPart(options: MockConversationPartOptions = {}): IntercomConversationPart {
  const now = nowTimestamp();
  const {
    id = `part_${randomId()}`,
    conversation_id,
    part_type = 'comment',
    body = 'This is a test message',
    author_type = 'user',
    author_id = `user_${randomId()}`,
    author_name = 'Test User',
    created_at = now,
  } = options;

  const part: IntercomConversationPart = {
    type: 'conversation_part',
    id,
    part_type,
    body,
    created_at,
    author: {
      type: author_type,
      id: author_id,
      name: author_name,
    },
  };

  // Add conversation_id to raw data if provided (for syncing)
  if (conversation_id) {
    (part as unknown as Record<string, unknown>).conversation_id = conversation_id;
  }

  return part;
}

export interface MockConversationOptions {
  id?: string;
  title?: string;
  state?: 'open' | 'closed' | 'snoozed';
  open?: boolean;
  priority?: 'priority' | 'not_priority';
  admin_assignee_id?: number;
  created_at?: number;
  updated_at?: number;
  parts?: IntercomConversationPart[];
}

export function createMockConversation(options: MockConversationOptions = {}): IntercomConversation {
  const now = nowTimestamp();
  const {
    id = `conv_${randomId()}`,
    title,
    state = 'open',
    open = true,
    priority,
    admin_assignee_id,
    created_at = now,
    updated_at = now,
    parts = [],
  } = options;

  return {
    type: 'conversation',
    id,
    title,
    state,
    open,
    priority,
    admin_assignee_id,
    created_at,
    updated_at,
    conversation_parts: {
      type: 'list',
      conversation_parts: parts,
    },
  };
}

export interface MockWebhookPayloadOptions {
  topic: string;
  item: Record<string, unknown>;
  app_id?: string;
  created_at?: number;
}

export function createMockWebhookPayload(options: MockWebhookPayloadOptions): IntercomWebhookPayload {
  const now = nowTimestamp();
  const {
    topic,
    item,
    app_id = 'app_test_123',
    created_at = now,
  } = options;

  return {
    type: 'notification_event',
    topic,
    id: `notif_${randomId()}`,
    app_id,
    data: {
      type: 'notification_event_data',
      item,
    },
    delivery_attempts: 1,
    first_sent_at: created_at,
    created_at,
  };
}

// =============================================================================
// App Config Mock
// =============================================================================

export interface MockIntercomAppConfigOptions {
  appKey?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  webhookSecret?: string;
  webhookSecretEnv?: string;
  syncResources?: IntercomResourceType[];
  syncFrom?: string;
}

export function createMockIntercomAppConfig(options: MockIntercomAppConfigOptions = {}) {
  const {
    appKey = 'intercom_test',
    apiKey,
    apiKeyEnv,
    webhookSecret,
    webhookSecretEnv,
    syncResources,
    syncFrom,
  } = options;

  const defaultApiKey = !apiKeyEnv ? (apiKey ?? 'test_api_key') : undefined;
  const defaultWebhookSecret = !webhookSecretEnv ? (webhookSecret ?? 'test_webhook_secret') : undefined;

  return {
    app_key: appKey,
    name: 'Intercom Test',
    connector: 'intercom',
    config: {
      ...(defaultApiKey && { api_key: defaultApiKey }),
      ...(apiKeyEnv && { api_key_env: apiKeyEnv }),
      ...(defaultWebhookSecret && { webhook_secret: defaultWebhookSecret }),
      ...(webhookSecretEnv && { webhook_secret_env: webhookSecretEnv }),
      ...(syncResources && { sync_resources: syncResources }),
      ...(syncFrom && { sync_from: syncFrom }),
    },
    ...(syncFrom && { sync_from: syncFrom }),
  };
}

// =============================================================================
// HMAC Signature Helper
// =============================================================================

/**
 * Compute HMAC SHA-1 signature for testing webhook verification
 */
export async function computeTestSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `sha1=${hashHex}`;
}

// =============================================================================
// Utility Helpers
// =============================================================================

function randomId(length = 14): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
