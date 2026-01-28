/**
 * Intercom Normalization Module
 *
 * Handles entity normalization and archived state detection.
 */

import type { AppConfig, NormalizedEntity } from '../../types/index.ts';
import { createNormalizedEntity } from '../utils.ts';
import { DEFAULT_API_VERSION } from './client.ts';
import {
  INTERCOM_COLLECTION_KEYS,
  type IntercomConversation,
  type IntercomResourceType,
} from './types.ts';

// =============================================================================
// Archived State Detection
// =============================================================================

/**
 * Detect archived state for an Intercom object based on resource type
 */
export function detectArchivedAt(
  resourceType: IntercomResourceType,
  data: Record<string, unknown>,
): Date | undefined {
  switch (resourceType) {
    case 'conversation': {
      // Conversations with state: "closed" should be marked as archived
      const conversationData = data as unknown as IntercomConversation;
      if (conversationData.state === 'closed') {
        // Use updated_at timestamp if available
        if (conversationData.updated_at) {
          return new Date(conversationData.updated_at * 1000);
        }
        return new Date();
      }
      return undefined;
    }

    case 'company':
    case 'contact':
    case 'admin':
    case 'conversation_part':
      // These resources don't have a direct archived state in Intercom
      // Check for generic deleted/archived fields
      if (data.deleted === true || data.archived === true) {
        const timestamp = data.deleted_at || data.archived_at;
        if (typeof timestamp === 'number') {
          return new Date(timestamp * 1000);
        }
        if (typeof timestamp === 'string') {
          return new Date(timestamp);
        }
        return new Date();
      }
      return undefined;

    default:
      return undefined;
  }
}

// =============================================================================
// Entity Normalization
// =============================================================================

/**
 * Normalize an Intercom object to the canonical entity format
 */
export function normalizeIntercomEntity(
  resourceType: IntercomResourceType,
  data: Record<string, unknown>,
  appConfig: AppConfig,
): NormalizedEntity {
  const externalId = data.id as string;
  const collectionKey = INTERCOM_COLLECTION_KEYS[resourceType];
  const archivedAt = detectArchivedAt(resourceType, data);

  return createNormalizedEntity({
    externalId,
    appKey: appConfig.app_key,
    collectionKey,
    rawPayload: data,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt,
  });
}
