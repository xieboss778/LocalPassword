import { FeatureFlag } from "@localpass/common/enums/feature-flag.enum";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";

export function isDefaultPasswordManagerPromptFeatureEnabled(
  configService: ConfigService,
): Promise<boolean> {
  return configService.getFeatureFlag(FeatureFlag.DefaultPasswordManagerPrompt);
}
