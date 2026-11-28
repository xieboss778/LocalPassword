// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyService } from "@localpass/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { StateProvider } from "@localpass/common/platform/state";
import { engine, services, strategies } from "@localpass/generator-core";
import { LocalGeneratorHistoryService } from "@localpass/generator-history";
import { DefaultGeneratorNavigationService } from "@localpass/generator-navigation";

import { LegacyPasswordGenerationService } from "./legacy-password-generation.service";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";

const { PassphraseGeneratorStrategy, PasswordGeneratorStrategy } = strategies;
const { SdkRandomizer, PasswordRandomizer } = engine;

const DefaultGeneratorService = services.DefaultGeneratorService;

export function legacyPasswordGenerationServiceFactory(
  policyService: PolicyService,
  accountService: AccountService,
  stateProvider: StateProvider,
): PasswordGenerationServiceAbstraction {
  const randomizer = new SdkRandomizer();
  const passwordRandomizer = new PasswordRandomizer(randomizer, Date.now);

  const passwords = new DefaultGeneratorService(
    new PasswordGeneratorStrategy(passwordRandomizer, stateProvider),
    policyService,
  );

  const passphrases = new DefaultGeneratorService(
    new PassphraseGeneratorStrategy(passwordRandomizer, stateProvider),
    policyService,
  );

  const navigation = new DefaultGeneratorNavigationService(stateProvider, policyService);

  const history = new LocalGeneratorHistoryService(stateProvider);

  return new LegacyPasswordGenerationService(
    accountService,
    navigation,
    passwords,
    passphrases,
    history,
  );
}
