import type { PasswordManagerClient } from "@localpass/sdk-internal";

/**
 * Factory for creating SDK clients.
 */
export abstract class SdkClientFactory {
  /**
   * Creates a new Password Manager client. Assumes the SDK is already loaded.
   * @param args Password Manager client constructor parameters
   */
  abstract createSdkClient(
    ...args: ConstructorParameters<typeof PasswordManagerClient>
  ): Promise<PasswordManagerClient>;
}
