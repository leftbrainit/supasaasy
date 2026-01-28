## ADDED Requirements

### Requirement: Intercom Connector Registration

The Intercom connector SHALL be registered with the connector registry.

#### Scenario: Connector available by provider name

- **WHEN** `getConnector("intercom")` is called
- **THEN** the Intercom connector SHALL be returned

#### Scenario: Metadata includes supported resources

- **WHEN** the Intercom connector metadata is queried
- **THEN** it SHALL list: company, contact, admin, conversation, conversation_part

### Requirement: Intercom Webhook Verification

The Intercom connector SHALL verify webhook signatures using HMAC SHA-1.

#### Scenario: Valid Intercom signature accepted

- **WHEN** a webhook with valid `X-Hub-Signature` header is received
- **THEN** verification SHALL pass
- **AND** the event SHALL be processed

#### Scenario: Invalid signature rejected

- **WHEN** a webhook with invalid or missing `X-Hub-Signature` header is received
- **THEN** verification SHALL fail
- **AND** 401 Unauthorized SHALL be returned

#### Scenario: Signature computed with client secret

- **WHEN** verifying a webhook signature
- **THEN** the connector SHALL compute HMAC SHA-1 of the request body
- **AND** use the configured webhook secret (client_secret) as the key
- **AND** compare against the `sha1=` prefixed value in `X-Hub-Signature`

### Requirement: Intercom Company Sync

The Intercom connector SHALL sync Company resources.

#### Scenario: Company created via webhook

- **WHEN** a `company.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "intercom_company"`

#### Scenario: Company full sync

- **WHEN** a full sync is performed for companies
- **THEN** all companies SHALL be fetched via the Companies API
- **AND** pagination SHALL be handled using cursor-based pagination

#### Scenario: Company full sync with sync_from

- **WHEN** a full sync is performed for companies with `sync_from` configured
- **THEN** only companies created on or after `sync_from` SHALL be fetched
- **AND** deletion detection SHALL NOT remove companies created before `sync_from`

### Requirement: Intercom Contact Sync

The Intercom connector SHALL sync Contact resources.

#### Scenario: Contact created via webhook

- **WHEN** a `contact.created` or `user.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "intercom_contact"`

#### Scenario: Contact updated via webhook

- **WHEN** a `user.email.updated` webhook is received
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Contact deleted via webhook

- **WHEN** a `user.deleted` webhook is received
- **THEN** the entity SHALL be physically deleted

#### Scenario: Contact full sync

- **WHEN** a full sync is performed for contacts
- **THEN** all contacts SHALL be fetched via the Contacts API
- **AND** pagination SHALL be handled using cursor-based pagination

### Requirement: Intercom Admin Sync

The Intercom connector SHALL sync Admin resources.

#### Scenario: Admin full sync

- **WHEN** a full sync is performed for admins
- **THEN** all admins SHALL be fetched via the Admins API

#### Scenario: Admin no webhook support

- **WHEN** the connector metadata is queried for admin resources
- **THEN** `supportsWebhooks` SHALL be false for admin resources

### Requirement: Intercom Conversation Sync

The Intercom connector SHALL sync Conversation resources.

#### Scenario: Conversation created via webhook

- **WHEN** a `conversation.user.created` or `conversation.admin.single.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "intercom_conversation"`

#### Scenario: Conversation updated via webhook

- **WHEN** a conversation-related webhook is received (replied, assigned, closed, etc.)
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Conversation closed state

- **WHEN** a conversation has `state: "closed"`
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Conversation full sync

- **WHEN** a full sync is performed for conversations
- **THEN** all conversations SHALL be fetched via the Conversations API
- **AND** pagination SHALL be handled using cursor-based pagination

#### Scenario: Conversation incremental sync

- **WHEN** an incremental sync is performed for conversations
- **THEN** the Conversations search API SHALL be used with `updated_at` filter
- **AND** only conversations modified since last sync SHALL be fetched

### Requirement: Intercom Conversation Part Sync

The Intercom connector SHALL sync Conversation Part resources.

#### Scenario: Conversation parts extracted from conversation

- **WHEN** a conversation is synced (webhook or API)
- **THEN** conversation parts SHALL be extracted from `conversation_parts.conversation_parts`
- **AND** each part SHALL be stored with `collection_key: "intercom_conversation_part"`

#### Scenario: Conversation part external ID

- **WHEN** a conversation part is normalized
- **THEN** the `external_id` SHALL be the part's `id` field

#### Scenario: Conversation part metadata preserved

- **WHEN** a conversation part is stored
- **THEN** the conversation ID SHALL be accessible via `raw_payload.conversation_id`

### Requirement: Intercom Views

The connector SHALL provide database views for common queries.

#### Scenario: Companies view available

- **WHEN** querying `supasaasy.intercom_companies`
- **THEN** the view SHALL return id, external_id, company_id, name, industry, size, website, created_at

#### Scenario: Contacts view available

- **WHEN** querying `supasaasy.intercom_contacts`
- **THEN** the view SHALL return id, external_id, email, name, role, phone, created_at

#### Scenario: Admins view available

- **WHEN** querying `supasaasy.intercom_admins`
- **THEN** the view SHALL return id, external_id, email, name, job_title, created_at

#### Scenario: Conversations view available

- **WHEN** querying `supasaasy.intercom_conversations`
- **THEN** the view SHALL return id, external_id, state, open, priority, admin_assignee_id, team_assignee_id, created_at, updated_at

#### Scenario: Conversation parts view available

- **WHEN** querying `supasaasy.intercom_conversation_parts`
- **THEN** the view SHALL return id, external_id, conversation_id, part_type, body, author_id, author_type, created_at

### Requirement: Intercom API Client

The connector SHALL use native fetch for Intercom API calls.

#### Scenario: Bearer token authentication

- **WHEN** making API requests to Intercom
- **THEN** the connector SHALL include `Authorization: Bearer {api_key}` header

#### Scenario: API version header

- **WHEN** making API requests to Intercom
- **THEN** the connector SHALL include `Intercom-Version: 2.14` header

#### Scenario: API version tracked in entities

- **WHEN** entities are synced
- **THEN** `api_version` SHALL be set to "2.14"

### Requirement: Intercom Configuration

The connector SHALL be configurable via app instance settings.

#### Scenario: API key from environment

- **WHEN** the connector initializes
- **THEN** the Intercom API key SHALL be loaded from environment variables

#### Scenario: Multiple instances supported

- **WHEN** multiple Intercom instances are configured (e.g., `intercom_sandbox`, `intercom_production`)
- **THEN** each SHALL have its own API key and webhook secret

#### Scenario: sync_from limits historical data

- **WHEN** an Intercom app instance has `sync_from` configured
- **THEN** full sync SHALL filter records by creation timestamp
- **AND** only records created on or after the timestamp SHALL be synced
