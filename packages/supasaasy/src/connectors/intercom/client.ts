/**
 * Intercom Client Module
 *
 * Handles Intercom API client creation and configuration helpers.
 * Uses native fetch for API calls since there's no official Intercom Deno SDK.
 */

import type { AppConfig } from '../../types/index.ts';
import type { ConfigValidationError, ConfigValidationResult } from '../index.ts';
import { createConnectorLogger } from '../utils.ts';
import type {
  IntercomAdmin,
  IntercomAppConfig,
  IntercomCompany,
  IntercomContact,
  IntercomConversation,
  IntercomConversationListResponse,
  IntercomPaginatedResponse,
  IntercomResourceType,
  IntercomSearchResponse,
} from './types.ts';

// =============================================================================
// Constants
// =============================================================================

export const CONNECTOR_NAME = 'intercom';
export const CONNECTOR_VERSION = '1.0.0';
export const DEFAULT_API_VERSION = '2.14';
export const DEFAULT_PAGE_SIZE = 50;
export const INTERCOM_API_BASE = 'https://api.intercom.io';

export const logger = createConnectorLogger(CONNECTOR_NAME);

/** Valid Intercom resource types */
const VALID_RESOURCE_TYPES: IntercomResourceType[] = [
  'company',
  'contact',
  'admin',
  'conversation',
  'conversation_part',
];

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Get Intercom client configuration from app config
 */
export function getIntercomConfig(appConfig: AppConfig): IntercomAppConfig {
  return appConfig.config as IntercomAppConfig;
}

/**
 * Get the Intercom API key (Access Token) from environment or config
 */
export function getApiKey(appConfig: AppConfig): string {
  const config = getIntercomConfig(appConfig);

  if (config.api_key_env) {
    const apiKey = Deno.env.get(config.api_key_env);
    if (apiKey) return apiKey;
  }

  if (config.api_key) {
    return config.api_key;
  }

  const defaultEnvKey = `INTERCOM_API_KEY_${appConfig.app_key.toUpperCase()}`;
  const defaultApiKey = Deno.env.get(defaultEnvKey);
  if (defaultApiKey) return defaultApiKey;

  throw new Error(`No Intercom API key found for app ${appConfig.app_key}`);
}

/**
 * Get the webhook signing secret (Client Secret) from environment or config
 */
export function getWebhookSecret(appConfig: AppConfig): string {
  const config = getIntercomConfig(appConfig);

  if (config.webhook_secret_env) {
    const secret = Deno.env.get(config.webhook_secret_env);
    if (secret) return secret;
  }

  if (config.webhook_secret) {
    return config.webhook_secret;
  }

  const defaultEnvKey = `INTERCOM_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`;
  const defaultSecret = Deno.env.get(defaultEnvKey);
  if (defaultSecret) return defaultSecret;

  throw new Error(`No Intercom webhook secret found for app ${appConfig.app_key}`);
}

/**
 * Get resource types to sync from config or defaults
 */
export function getResourceTypesToSync(appConfig: AppConfig): IntercomResourceType[] {
  const config = getIntercomConfig(appConfig);
  if (config.sync_resources && config.sync_resources.length > 0) {
    return config.sync_resources;
  }
  // Default to all resources except conversation_part (synced with conversations)
  return ['company', 'contact', 'admin', 'conversation'];
}

/**
 * Get sync_from timestamp from app config if configured.
 * Returns the timestamp as a Unix timestamp (seconds) for Intercom API.
 */
export function getSyncFromTimestamp(appConfig: AppConfig): number | undefined {
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', `Invalid sync_from date in AppConfig: ${appConfig.sync_from}`);
  }

  const config = getIntercomConfig(appConfig);
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', `Invalid sync_from date in IntercomAppConfig: ${config.sync_from}`);
  }

  return undefined;
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Intercom API client for making requests
 */
export interface IntercomClient {
  /** Make a GET request to the Intercom API */
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  /** Make a POST request to the Intercom API */
  post<T>(path: string, body: unknown): Promise<T>;
  /** List companies with pagination */
  listCompanies(
    cursor?: string,
    perPage?: number,
  ): Promise<IntercomPaginatedResponse<IntercomCompany>>;
  /** List contacts with pagination */
  listContacts(
    cursor?: string,
    perPage?: number,
  ): Promise<IntercomPaginatedResponse<IntercomContact>>;
  /** List admins (no pagination) */
  listAdmins(): Promise<{ type: 'admin.list'; admins: IntercomAdmin[] }>;
  /** List conversations with pagination */
  listConversations(cursor?: string, perPage?: number): Promise<IntercomConversationListResponse>;
  /** Get a single conversation with parts */
  getConversation(conversationId: string): Promise<IntercomConversation>;
  /** Search conversations by updated_at for incremental sync */
  searchConversations(
    updatedSince: number,
    cursor?: string,
    perPage?: number,
  ): Promise<IntercomSearchResponse<IntercomConversation>>;
}

/**
 * Create an Intercom API client for the given app configuration
 */
export function createIntercomClient(appConfig: AppConfig): IntercomClient {
  const apiKey = getApiKey(appConfig);

  /**
   * Make a request to the Intercom API
   */
  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    let url = `${INTERCOM_API_BASE}${path}`;

    // Add query params for GET requests
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Intercom-Version': DEFAULT_API_VERSION,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.debug('api', `${method} ${path}`, { params });

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Intercom API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          errorMessage = errorJson.errors.map((e: { message?: string }) => e.message).join(', ');
        }
      } catch {
        // If parsing fails, use the raw text if available
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json() as T;
  }

  return {
    get<T>(path: string, params?: Record<string, string>): Promise<T> {
      return request<T>('GET', path, params);
    },

    post<T>(path: string, body: unknown): Promise<T> {
      return request<T>('POST', path, undefined, body);
    },

    listCompanies(cursor?: string, perPage = DEFAULT_PAGE_SIZE) {
      const params: Record<string, string> = {
        per_page: String(perPage),
      };
      if (cursor) {
        params.starting_after = cursor;
      }
      return request<IntercomPaginatedResponse<IntercomCompany>>('GET', '/companies', params);
    },

    listContacts(cursor?: string, perPage = DEFAULT_PAGE_SIZE) {
      const params: Record<string, string> = {
        per_page: String(perPage),
      };
      if (cursor) {
        params.starting_after = cursor;
      }
      return request<IntercomPaginatedResponse<IntercomContact>>('GET', '/contacts', params);
    },

    listAdmins() {
      return request<{ type: 'admin.list'; admins: IntercomAdmin[] }>('GET', '/admins');
    },

    listConversations(cursor?: string, perPage = DEFAULT_PAGE_SIZE) {
      const params: Record<string, string> = {
        per_page: String(perPage),
      };
      if (cursor) {
        params.starting_after = cursor;
      }
      return request<IntercomConversationListResponse>('GET', '/conversations', params);
    },

    getConversation(conversationId: string) {
      return request<IntercomConversation>('GET', `/conversations/${conversationId}`);
    },

    searchConversations(updatedSince: number, cursor?: string, perPage = DEFAULT_PAGE_SIZE) {
      const body = {
        query: {
          field: 'updated_at',
          operator: '>',
          value: updatedSince,
        },
        pagination: {
          per_page: perPage,
          ...(cursor && { starting_after: cursor }),
        },
      };
      return request<IntercomSearchResponse<IntercomConversation>>(
        'POST',
        '/conversations/search',
        undefined,
        body,
      );
    },
  };
}

// =============================================================================
// Configuration Validation
// =============================================================================

/**
 * Validate Intercom connector configuration
 */
export function validateIntercomConfig(appConfig: AppConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const config = getIntercomConfig(appConfig);

  // Validate API key configuration
  const hasApiKeyEnv = config.api_key_env && Deno.env.get(config.api_key_env);
  const hasApiKey = !!config.api_key;
  const hasDefaultApiKey = Deno.env.get(`INTERCOM_API_KEY_${appConfig.app_key.toUpperCase()}`);

  if (!hasApiKeyEnv && !hasApiKey && !hasDefaultApiKey) {
    errors.push({
      field: 'api_key',
      message: 'No Intercom API key configured',
      suggestion: `Set ${
        config.api_key_env || `INTERCOM_API_KEY_${appConfig.app_key.toUpperCase()}`
      } environment variable`,
    });
  }

  // Validate webhook secret (only warn, as it's only required for webhook handling)
  const hasWebhookSecretEnv = config.webhook_secret_env && Deno.env.get(config.webhook_secret_env);
  const hasWebhookSecret = !!config.webhook_secret;
  const hasDefaultWebhookSecret = Deno.env.get(
    `INTERCOM_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`,
  );

  if (!hasWebhookSecretEnv && !hasWebhookSecret && !hasDefaultWebhookSecret) {
    logger.warn(
      'config',
      `No webhook secret configured for ${appConfig.app_key}. Webhook verification will fail.`,
    );
  }

  // Validate sync_resources if provided
  if (config.sync_resources && config.sync_resources.length > 0) {
    for (const resource of config.sync_resources) {
      if (!VALID_RESOURCE_TYPES.includes(resource)) {
        errors.push({
          field: 'sync_resources',
          message: `Invalid resource type: ${resource}`,
          suggestion: `Valid types are: ${VALID_RESOURCE_TYPES.join(', ')}`,
        });
      }
    }
  }

  // Validate sync_from date format if provided
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: `Invalid date format: ${config.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  // Also check AppConfig.sync_from
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: `Invalid date format in AppConfig: ${appConfig.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
