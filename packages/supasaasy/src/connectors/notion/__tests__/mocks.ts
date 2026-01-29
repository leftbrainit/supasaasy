/**
 * Notion Connector Test Mocks
 *
 * Mock data factories for testing the Notion connector.
 */

import type { AppConfig } from '../../../types/index.ts';
import type {
  NotionDataSource,
  NotionPage,
  NotionProperty,
  NotionUser,
  NotionWebhookPayload,
} from '../types.ts';

// =============================================================================
// Time Helpers
// =============================================================================

/**
 * Get current ISO timestamp
 */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get ISO timestamp from N days ago
 */
export function pastIsoTimestamp(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// =============================================================================
// App Config Mocks
// =============================================================================

/**
 * Create a mock Notion app configuration
 */
export function createMockNotionAppConfig(
  overrides: Partial<AppConfig> = {},
): AppConfig {
  return {
    app_key: 'notion_test',
    name: 'Notion Test',
    connector: 'notion',
    config: {
      api_key_env: 'NOTION_API_KEY',
      webhook_secret_env: 'NOTION_WEBHOOK_SECRET',
      // Direct secret for testing (bypasses env var lookup)
      webhook_secret: 'test_webhook_secret_12345',
      api_key: 'test_api_key_12345',
    },
    ...overrides,
  };
}

// =============================================================================
// Data Source Mocks
// =============================================================================

/**
 * Create a mock Notion property schema
 */
export function createMockProperty(
  overrides: Partial<NotionProperty> = {},
): NotionProperty {
  return {
    id: 'kqLW',
    name: 'Name',
    type: 'title',
    title: {},
    ...overrides,
  };
}

/**
 * Create a mock Notion data source
 */
export function createMockDataSource(
  overrides: Partial<Omit<NotionDataSource, 'title'> & { id?: string; title?: string }> = {},
): NotionDataSource {
  const id = overrides.id ?? '2f26ee68-df30-4251-aad4-8ddc420cba3d';
  const title = overrides.title ?? 'Test Data Source';
  const now = nowIsoTimestamp();

  return {
    object: 'data_source',
    id,
    parent: {
      type: 'database_id',
      database_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    },
    title: [
      {
        type: 'text',
        text: { content: title, link: null },
        plain_text: title,
      },
    ],
    properties: {
      Name: createMockProperty({ id: 'title', name: 'Name', type: 'title' }),
      Status: createMockProperty({
        id: 'status',
        name: 'Status',
        type: 'status',
        status: {
          options: [
            { id: 'opt1', name: 'Not started', color: 'default' },
            { id: 'opt2', name: 'In progress', color: 'blue' },
            { id: 'opt3', name: 'Done', color: 'green' },
          ],
          groups: [
            { id: 'grp1', name: 'To-do', color: 'gray', option_ids: ['opt1'] },
            { id: 'grp2', name: 'In progress', color: 'blue', option_ids: ['opt2'] },
            { id: 'grp3', name: 'Complete', color: 'green', option_ids: ['opt3'] },
          ],
        },
      }),
    },
    archived: false,
    in_trash: false,
    created_time: now,
    last_edited_time: now,
    created_by: { object: 'user', id: 'user-123' },
    last_edited_by: { object: 'user', id: 'user-123' },
    url: `https://www.notion.so/${id.replace(/-/g, '')}`,
    ...overrides,
  } as NotionDataSource;
}

// =============================================================================
// Page Mocks
// =============================================================================

/**
 * Create a mock Notion page
 */
export function createMockPage(
  overrides: Partial<NotionPage & { id?: string; title?: string; dataSourceId?: string }> = {},
): NotionPage {
  const id = overrides.id ?? '3f37ff79-ef41-5362-bbe5-9eec531d5db4';
  const title = overrides.title ?? 'Test Page';
  const dataSourceId = overrides.dataSourceId ?? '2f26ee68-df30-4251-aad4-8ddc420cba3d';
  const now = nowIsoTimestamp();

  return {
    object: 'page',
    id,
    parent: {
      type: 'database_id',
      database_id: dataSourceId,
    },
    properties: {
      Name: {
        id: 'title',
        type: 'title',
        title: [{ plain_text: title }],
      },
      Status: {
        id: 'status',
        type: 'status',
        status: { id: 'opt2', name: 'In progress', color: 'blue' },
      },
    },
    archived: false,
    in_trash: false,
    created_time: now,
    last_edited_time: now,
    created_by: { object: 'user', id: 'user-123' },
    last_edited_by: { object: 'user', id: 'user-123' },
    url: `https://www.notion.so/${id.replace(/-/g, '')}`,
    ...overrides,
  } as NotionPage;
}

// =============================================================================
// User Mocks
// =============================================================================

/**
 * Create a mock Notion user
 */
export function createMockUser(
  overrides: Partial<NotionUser & { id?: string; name?: string; email?: string }> = {},
): NotionUser {
  const id = overrides.id ?? '4g48gg80-fg52-6473-ccf6-0ffd642e6ed5';
  const name = overrides.name ?? 'Test User';
  const email = overrides.email ?? 'test@example.com';

  return {
    object: 'user',
    id,
    type: 'person',
    name,
    avatar_url: `https://example.com/avatar/${id}.png`,
    person: {
      email,
    },
    ...overrides,
  } as NotionUser;
}

/**
 * Create a mock Notion bot user
 */
export function createMockBotUser(
  overrides: Partial<NotionUser & { id?: string; name?: string }> = {},
): NotionUser {
  const id = overrides.id ?? '5h59hh91-gh63-7584-ddf7-1ggd753f7fe6';
  const name = overrides.name ?? 'Test Bot';

  return {
    object: 'user',
    id,
    type: 'bot',
    name,
    avatar_url: null,
    bot: {
      owner: {
        type: 'workspace',
        workspace: true,
      },
      workspace_name: 'Test Workspace',
    },
    ...overrides,
  } as NotionUser;
}

// =============================================================================
// Webhook Event Mocks
// =============================================================================

/**
 * Create a mock Notion webhook payload
 */
export function createMockWebhookPayload(
  overrides: Partial<NotionWebhookPayload & { type?: string; objectType?: string }> = {},
): NotionWebhookPayload {
  const eventType = overrides.type ?? 'data_source.created';
  const now = nowIsoTimestamp();

  // Determine object and entity reference based on event type
  let dataObject: NotionDataSource | NotionPage;
  let entity: { id: string; type: string };

  if (eventType.startsWith('page.')) {
    const page = createMockPage();
    dataObject = page;
    entity = { id: page.id, type: 'page' };
  } else {
    const dataSource = createMockDataSource();
    dataObject = dataSource;
    entity = { id: dataSource.id, type: 'data_source' };
  }

  return {
    id: 'evt_test123',
    type: eventType,
    timestamp: now,
    workspace_id: 'ws_test123',
    integration_id: 'int_test123',
    entity,
    data: {
      object: dataObject,
    },
    ...overrides,
  } as NotionWebhookPayload;
}

/**
 * Create a mock data_source.created webhook event
 */
export function createMockDataSourceCreatedEvent(
  dataSourceOverrides: Partial<Omit<NotionDataSource, 'title'> & { id?: string; title?: string }> = {},
): NotionWebhookPayload {
  const dataSource = createMockDataSource(dataSourceOverrides);
  return createMockWebhookPayload({
    type: 'data_source.created',
    entity: { id: dataSource.id, type: 'data_source' },
    data: {
      data_source: dataSource,
    },
  });
}

/**
 * Create a mock data_source.schema_updated webhook event
 */
export function createMockDataSourceUpdatedEvent(
  dataSourceOverrides: Partial<Omit<NotionDataSource, 'title'> & { id?: string; title?: string }> = {},
): NotionWebhookPayload {
  const dataSource = createMockDataSource(dataSourceOverrides);
  return createMockWebhookPayload({
    type: 'data_source.schema_updated',
    entity: { id: dataSource.id, type: 'data_source' },
    data: {
      data_source: dataSource,
    },
  });
}

/**
 * Create a mock data_source.deleted webhook event
 */
export function createMockDataSourceDeletedEvent(
  dataSourceId: string = '2f26ee68-df30-4251-aad4-8ddc420cba3d',
): NotionWebhookPayload {
  const now = nowIsoTimestamp();
  return {
    id: 'evt_del123',
    type: 'data_source.deleted',
    timestamp: now,
    workspace_id: 'ws_test123',
    integration_id: 'int_test123',
    entity: { id: dataSourceId, type: 'data_source' },
    data: {
      deleted_object: {
        object: 'data_source',
        id: dataSourceId,
      },
    },
  };
}

/**
 * Create a mock page.created webhook event
 */
export function createMockPageCreatedEvent(
  pageOverrides: Partial<NotionPage & { id?: string }> = {},
): NotionWebhookPayload {
  const page = createMockPage(pageOverrides);
  return createMockWebhookPayload({
    type: 'page.created',
    entity: { id: page.id, type: 'page' },
    data: {
      page: page,
    },
  });
}

/**
 * Create a mock page.properties_updated webhook event
 */
export function createMockPageUpdatedEvent(
  pageOverrides: Partial<NotionPage & { id?: string }> = {},
): NotionWebhookPayload {
  const page = createMockPage(pageOverrides);
  return createMockWebhookPayload({
    type: 'page.properties_updated',
    entity: { id: page.id, type: 'page' },
    data: {
      // For update events, we may only have partial data
      parent: page.parent,
      updated_properties: ['Title'],
    },
  });
}

/**
 * Create a mock page.deleted webhook event
 */
export function createMockPageDeletedEvent(
  pageId: string = '3f37ff79-ef41-5362-bbe5-9eec531d5db4',
): NotionWebhookPayload {
  const now = nowIsoTimestamp();
  return {
    id: 'evt_del456',
    type: 'page.deleted',
    timestamp: now,
    workspace_id: 'ws_test123',
    integration_id: 'int_test123',
    entity: { id: pageId, type: 'page' },
    data: {
      deleted_object: {
        object: 'page',
        id: pageId,
      },
    },
  };
}
