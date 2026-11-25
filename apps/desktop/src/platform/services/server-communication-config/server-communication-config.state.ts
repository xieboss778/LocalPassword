import { ServerCommunicationConfig } from "@localpass/sdk-internal";
import { KeyDefinition, SERVER_COMMUNICATION_CONFIG_DISK } from "@localpass/state";

/**
 * Key definition for server communication configurations.
 *
 * Record type: Maps hostname (string) to ServerCommunicationConfig
 * Storage: Disk (persisted across sessions)
 * Scope: Global (application-level, not user-specific)
 */
export const SERVER_COMMUNICATION_CONFIGS = KeyDefinition.record<ServerCommunicationConfig, string>(
  SERVER_COMMUNICATION_CONFIG_DISK,
  "configs",
  {
    deserializer: (value: ServerCommunicationConfig) => value,
  },
);
