import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ImporterLoginResult } from "@localpass/importer-core";

/** Imports logins from an already-authorized profile. Used by DesktopImportUpgradeMetadataService. */
export async function loadChromiumLogins(
  browser: string,
  profileId: string,
  i18nService: I18nService,
): Promise<ImporterLoginResult[]> {
  try {
    return await ipc.tools.chromiumImporter.importLogins(browser, profileId);
  } catch {
    throw new Error(i18nService.t("errorOccurred"));
  }
}
