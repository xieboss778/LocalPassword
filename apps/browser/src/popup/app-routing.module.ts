import { Injectable, NgModule } from "@angular/core";
import { ActivatedRouteSnapshot, RouteReuseStrategy, RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@localpass/angular/auth/components/authentication-timeout.component";
import { AuthRoute } from "@localpass/angular/auth/constants";
import { EnvironmentSelectorComponent } from "@localpass/angular/auth/environment-selector/environment-selector.component";
import {
  activeAuthGuard,
  authGuard,
  hasPasswordGuard,
  lockGuard,
  redirectGuard,
  redirectToVaultIfUnlockedGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@localpass/angular/auth/guards";
import {
  CreateLocalVaultComponent,
  LocalVaultStartComponent,
  RestoreVaultV2Component,
} from "@localpass/angular/auth/local-vault";
import { LoginViaWebAuthnComponent } from "@localpass/angular/auth/login-via-webauthn/login-via-webauthn.component";
import { ChangePasswordComponent } from "@localpass/angular/auth/password-management/change-password";
import { SetInitialPasswordComponent } from "@localpass/angular/auth/password-management/set-initial-password/set-initial-password.component";
import {
  RegistrationFinishComponent,
  RegistrationStartComponent,
  RegistrationStartSecondaryComponent,
  RegistrationStartSecondaryComponentData,
} from "@localpass/angular/auth/registration";
import { canAccessFeature } from "@localpass/angular/platform/guard/feature-flag.guard";
import { featureFlaggedRoute } from "@localpass/angular/platform/utils/feature-flagged-route";
import { BackupSettingsV2Component } from "@localpass/angular/tools/backup";
import { FoldersV2Component } from "@localpass/angular/tools/folders";
import {
  GeneratorHistoryV2Component,
  GeneratorV2Component,
} from "@localpass/angular/tools/generator";
import { ItemFormV2Component, NewItemV2Component } from "@localpass/angular/tools/item-entry";
import {
  DevicesIcon,
  ExpiredIcon,
  EmailCodeSentIcon,
  UserLockIcon,
  VaultIcon,
  LockIcon,
  DomainIcon,
} from "@localpass/assets/svg";
import {
  LoginDecryptionOptionsComponent,
  LoginViaAuthRequestComponent,
  NewDeviceVerificationComponent,
  PasswordHintComponent,
  SsoComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
} from "@localpass/auth/angular";
import { canAccessAutoConfirmSettings } from "@localpass/auto-confirm/angular";
import { FeatureFlag } from "@localpass/common/enums/feature-flag.enum";
import { RestrictedCipherAction } from "@localpass/common/vault/utils/restricted-cipher-policy";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "@localpass/components";
import { canActivateImportType, IMPORT_DESTINATION_ROUTE_PATH } from "@localpass/importer-ui";
import {
  LockComponent,
  ConfirmKeyConnectorDomainComponent,
  RemovePasswordComponent,
} from "@localpass/key-management-ui";
import { MY_ITEMS_ROUTE, MY_ITEMS_ROUTE_DATA, vaultScopeGuard } from "@localpass/vault";

import { AccountSwitcherComponent } from "../auth/popup/account-switching/account-switcher.component";
import { AuthExtensionRoute } from "../auth/popup/constants/auth-extension-route.constant";
import { fido2AuthGuard } from "../auth/popup/guards/fido2-auth.guard";
import { platformPopoutGuard } from "../auth/popup/guards/platform-popout.guard";
import { SecurityKeyComponent } from "../auth/popup/security-key/security-key.component";
import { AccountSecurityComponent } from "../auth/popup/settings/account-security.component";
import { ChangePasswordPageComponent } from "../auth/popup/settings/change-password-page.component";
import { ExtensionDeviceManagementComponent } from "../auth/popup/settings/extension-device-management.component";
import { AutofillToolsComponent } from "../autofill/popup/autofill-tools/autofill-tools.component";
import { autofillToolsDevFlagGuard } from "../autofill/popup/autofill-tools/autofill-tools.guard";
import { DefaultPasswordManagerPromptComponent } from "../autofill/popup/default-password-manager/default-password-manager-prompt.component";
import { Fido2Component } from "../autofill/popup/fido2/fido2.component";
import { AutofillComponent } from "../autofill/popup/settings/autofill.component";
import { BlockedDomainsComponent } from "../autofill/popup/settings/blocked-domains.component";
import { ExcludedDomainsComponent } from "../autofill/popup/settings/excluded-domains.component";
import { NotificationsSettingsComponent } from "../autofill/popup/settings/notifications.component";
import { PremiumV2Component } from "../billing/popup/settings/premium-v2.component";
import { HealthRiskCategoryDetailComponent } from "../dirt/health/popup/health-risk-category-detail.component";
import { HealthComponent } from "../dirt/health/popup/health.component";
import {
  canAccessHealth,
  canAccessHealthDetail,
} from "../dirt/health/popup/services/health-access.service";
import { PhishingWarningComponent } from "../dirt/phishing-detection/popup/phishing-warning.component";
import { ProtectedByComponent } from "../dirt/phishing-detection/popup/protected-by-component";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { popupRouterCacheGuard } from "../platform/popup/view-cache/popup-router-cache.service";
import { RouteCacheOptions } from "../platform/services/popup-view-cache-background.service";
import { CredentialGeneratorHistoryComponent } from "../tools/popup/generator/credential-generator-history.component";
import { CredentialGeneratorComponent } from "../tools/popup/generator/credential-generator.component";
import { filePickerPopoutGuard } from "../tools/popup/guards/file-picker-popout.guard";
import { importUpgradeRedirectGuard } from "../tools/popup/guards/import-upgrade-redirect.guard";
import { importUpgradeRequiredGuard } from "../tools/popup/guards/import-upgrade-required.guard";
import { SendAddEditComponent as SendAddEditV2Component } from "../tools/popup/send-v2/add-edit/send-add-edit.component";
import { SendCreatedComponent } from "../tools/popup/send-v2/send-created/send-created.component";
import { SendV2Component } from "../tools/popup/send-v2/send-v2.component";
import { ExportBrowserV2Component } from "../tools/popup/settings/export/export-browser-v2.component";
import { GoogleAuthImportV2Component } from "../tools/popup/settings/import/google-auth-import-v2.component";
import { ImportBrowserV2Component } from "../tools/popup/settings/import/import-browser-v2.component";
import { IMPORT_CONFIRMATION_ROUTE_PATH } from "../tools/popup/settings/import/import-confirmation-state.service";
import { ImportShellBrowserComponent } from "../tools/popup/settings/import/import-shell-browser.component";
import { ImportSourceV2Component } from "../tools/popup/settings/import/import-source-v2.component";
import { AboutV2Component } from "../tools/popup/settings/localpass/about-v2.component";
import { AppearanceV2Component } from "../tools/popup/settings/localpass/appearance-v2.component";
import { DataSafetyV2Component } from "../tools/popup/settings/localpass/data-safety-v2.component";
import { NetworkGateV2Component } from "../tools/popup/settings/localpass/network-gate-v2.component";
import { SecuritySettingsV2Component } from "../tools/popup/settings/localpass/security-settings-v2.component";
import { SettingsListV2Component } from "../tools/popup/settings/localpass/settings-list-v2.component";
import { ShareItemComponent } from "../tools/popup/share/share-item.component";
import { AtRiskPasswordsComponent } from "../vault/popup/components/at-risk-passwords/at-risk-passwords.component";
import { VaultItemViewV2Component } from "../vault/popup/components/item-view-v2/item-view-v2.component";
import { TotpQrV2Component } from "../vault/popup/components/totp-qr-v2/totp-qr-v2.component";
import { TrashV2Component } from "../vault/popup/components/trash-v2/trash-v2.component";
import { AddEditComponent } from "../vault/popup/components/vault/add-edit/add-edit.component";
import { AssignCollections } from "../vault/popup/components/vault/assign-collections/assign-collections.component";
import { AttachmentsComponent } from "../vault/popup/components/vault/attachments/attachments.component";
import { IntroCarouselComponent } from "../vault/popup/components/vault/intro-carousel/intro-carousel.component";
import { NewItemPageComponent } from "../vault/popup/components/vault/new-item-page/new-item-page.component";
import { PasswordHistoryComponent } from "../vault/popup/components/vault/vault-password-history/vault-password-history.component";
import { WelcomePageComponent } from "../vault/popup/components/vault/welcome-page/welcome-page.component";
import { VaultListV2Component } from "../vault/popup/components/vault-list-v2/vault-list-v2.component";
import {
  atRiskPasswordAuthGuard,
  canAccessAtRiskPasswords,
  hasAtRiskPasswords,
} from "../vault/popup/guards/at-risk-passwords.guard";
import { clearVaultStateGuard } from "../vault/popup/guards/clear-vault-state.guard";
import { restoreVaultScopeGuard } from "../vault/popup/guards/restore-vault-scope.guard";
import { restrictedCipherGuard } from "../vault/popup/guards/restricted-cipher.guard";
import { AdminSettingsComponent } from "../vault/popup/settings/admin-settings.component";
import { ArchiveComponent } from "../vault/popup/settings/archive.component";
import { DownloadLocalPassComponent } from "../vault/popup/settings/download-localpass.component";
import { MoreFromLocalPassPageComponent } from "../vault/popup/settings/more-from-localpass-page.component";
import { VaultSettingsComponent } from "../vault/popup/settings/vault-settings.component";

import { RouteElevation } from "./app-routing.animations";
import {
  ExtensionAnonLayoutWrapperComponent,
  ExtensionAnonLayoutWrapperData,
} from "./components/extension-anon-layout-wrapper/extension-anon-layout-wrapper.component";
import { debounceNavigationGuard } from "./services/debounce-navigation.service";
import { TabsV2Component } from "./tabs-v2.component";

/**
 * Data properties acceptable for use in extension route objects
 */
export interface RouteDataProperties extends RouteCacheOptions {
  elevation: RouteElevation;

  /** Marks the import shell route; NoRouteReuseStrategy reuses it across its child routes. */
  importShell?: boolean;

  /** Renders a shared desktop page in its 380px popup layout. */
  compact?: boolean;

  /** The page the local-vault creation flow opens when the user chose restore-from-file. */
  importRoute?: string;

  /**
   * A boolean to indicate that the URL should not be saved in memory in the BrowserRouterService.
   */
  doNotSaveUrl?: boolean;
}

const unauthRouteOverrides = {
  homepage: () => {
    return BrowserPopupUtils.inPopout(window) ? "/tabs/vault" : "/tabs/current";
  },
};

const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [], // Children lets us have an empty component.
    canActivate: [
      popupRouterCacheGuard,
      redirectGuard({ loggedIn: "/tabs/current", loggedOut: "/login", locked: "/lock" }),
    ],
  },
  {
    path: "home",
    redirectTo: "login",
    pathMatch: "full",
  },
  {
    path: "vault",
    redirectTo: "/tabs/vault",
    pathMatch: "full",
  },
  {
    path: "fido2",
    component: Fido2Component,
    canActivate: [fido2AuthGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "",
    component: ExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.AuthenticationTimeout,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        children: [
          {
            path: "",
            component: AuthenticationTimeoutComponent,
          },
        ],
        data: {
          pageTitle: {
            key: "authenticationTimeout",
          },
          pageIcon: ExpiredIcon,
          elevation: 1,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
    ],
  },
  {
    path: AuthRoute.NewDeviceVerification,
    component: ExtensionAnonLayoutWrapperComponent,
    canActivate: [unauthGuardFn(), activeAuthGuard()],
    children: [{ path: "", component: NewDeviceVerificationComponent }],
    data: {
      pageIcon: EmailCodeSentIcon,
      pageTitle: {
        key: "verifyYourIdentity",
      },
      pageSubtitle: {
        key: "weDontRecognizeThisDevice",
      },
      showBackButton: true,
      elevation: 1,
    } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
  },
  {
    path: "remove-password",
    component: ExtensionAnonLayoutWrapperComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        component: RemovePasswordComponent,
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          showBackButton: false,
          pageIcon: LockIcon,
        } satisfies ExtensionAnonLayoutWrapperData,
      },
    ],
  },
  {
    // LocalPassword：方向 C 的新建第一步——选类型。
    path: "new-item-v2",
    component: NewItemV2Component,
    canActivate: [authGuard],
    data: { elevation: 2, compact: true } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：方向 C 的新建 / 编辑表单，靠 query 上的 kind 与 cipherId 区分。
    path: "edit-item-v2",
    component: ItemFormV2Component,
    canActivate: [authGuard],
    data: { elevation: 2, compact: true } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：动态口令二维码（扫码进认证器）。
    path: "totp-qr-v2",
    component: TotpQrV2Component,
    canActivate: [authGuard],
    data: { elevation: 3, compact: true } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：方向 C 的条目详情（点行复制）。
    path: "view-cipher-v2",
    component: VaultItemViewV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：方向 C 的新列表，逐个替换旧界面时先用独立路由对比。
    path: "vault-list-v2",
    component: VaultListV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "view-cipher",
    component: VaultItemViewV2Component,
    canActivate: [authGuard],
    data: {
      // Above "trash"
      elevation: 3,
    } satisfies RouteDataProperties,
  },
  {
    path: "cipher-password-history",
    component: PasswordHistoryComponent,
    canActivate: [authGuard],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "new-item",
    component: NewItemPageComponent,
    canActivate: [
      authGuard,
      canAccessFeature(FeatureFlag.PM32009NewItemTypes, true, undefined, false),
    ],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "add-cipher",
    component: AddEditComponent,
    canActivate: [authGuard, debounceNavigationGuard()],
    data: { elevation: 1, resetRouterCacheOnTabChange: true } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "edit-cipher",
    component: AddEditComponent,
    canActivate: [
      authGuard,
      debounceNavigationGuard(),
      restrictedCipherGuard(RestrictedCipherAction.Edit),
    ],
    data: {
      // Above "trash"
      elevation: 3,
      resetRouterCacheOnTabChange: true,
    } satisfies RouteDataProperties,
    runGuardsAndResolvers: "always",
  },
  {
    path: "attachments",
    component: AttachmentsComponent,
    canActivate: [authGuard, filePickerPopoutGuard()],
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    path: "generator",
    component: CredentialGeneratorComponent,
    canActivate: [authGuard],
    data: { elevation: 0 } satisfies RouteDataProperties,
  },
  {
    path: "generator-history",
    component: CredentialGeneratorHistoryComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "import",
    component: ImportBrowserV2Component,
    canActivate: [authGuard, importUpgradeRedirectGuard, filePickerPopoutGuard()],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：方向 C 的导入来源选择（清单来自 ImportService，不是手抄的）。
    path: "import-source-v2",
    component: ImportSourceV2Component,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "import-source-select",
    component: ImportShellBrowserComponent,
    canActivate: [authGuard, importUpgradeRequiredGuard],
    data: { elevation: 1, importShell: true } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        pathMatch: "full",
        // Lazy load vendor icon set
        loadComponent: () =>
          import("../tools/popup/settings/import/import-source-select-browser.component").then(
            (m) => m.ImportSourceSelectBrowserComponent,
          ),
        data: { elevation: 1 } satisfies RouteDataProperties,
      },
      {
        path: ":importType",
        loadComponent: () =>
          import("../tools/popup/settings/import/import-controls-browser.component").then(
            (m) => m.ImportControlsBrowserComponent,
          ),
        canActivate: [canActivateImportType("/import-source-select")],
        data: { elevation: 1 } satisfies RouteDataProperties,
      },
      {
        path: IMPORT_DESTINATION_ROUTE_PATH,
        loadComponent: () =>
          import("../tools/popup/settings/import/import-destination-browser.component").then(
            (m) => m.ImportDestinationBrowserComponent,
          ),
        canActivate: [canActivateImportType("/import-source-select")],
        data: { elevation: 1 } satisfies RouteDataProperties,
      },
    ],
  },
  {
    path: IMPORT_CONFIRMATION_ROUTE_PATH,
    loadComponent: () =>
      import("../tools/popup/settings/import/import-confirmation-browser.component").then(
        (m) => m.ImportConfirmationBrowserComponent,
      ),
    canActivate: [authGuard, importUpgradeRequiredGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // LocalPass: importing Google Authenticator's migration export.
    path: "import-google-auth",
    component: GoogleAuthImportV2Component,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "export",
    component: ExportBrowserV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：网络闸门（三条规则 + 当前存储端点）。
    path: "settings-network-v2",
    component: NetworkGateV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：数据与安全（只陈述事实，不做无确认的清空）。
    path: "settings-data-v2",
    component: DataSafetyV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // LocalPassword：方向 C 的安全设置页（扩展里不出现 Touch ID）。
    path: "settings-security-v2",
    component: SecuritySettingsV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    // LocalPass: register a security key (PRF) as an unlock method.
    path: "security-key",
    component: SecurityKeyComponent,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    // LocalPass: cloud backup settings for a local vault.
    path: "backup-settings",
    component: BackupSettingsV2Component,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "autofill",
    component: AutofillComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.AccountSecurity,
    component: AccountSecurityComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.SettingsPassword,
    component: ChangePasswordPageComponent,
    canActivate: [authGuard, hasPasswordGuard([`/${AuthExtensionRoute.AccountSecurity}`])],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: AuthExtensionRoute.DeviceManagement,
    component: ExtensionDeviceManagementComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "notifications",
    component: NotificationsSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "vault-settings",
    component: VaultSettingsComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "folders",
    component: FoldersV2Component,
    canActivate: [authGuard],
    data: { elevation: 2, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "blocked-domains",
    component: BlockedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "excluded-domains",
    component: ExcludedDomainsComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "premium",
    component: PremiumV2Component,
    canActivate: [authGuard],
    data: { elevation: 3 } satisfies RouteDataProperties,
  },
  {
    path: "appearance",
    component: AppearanceV2Component,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "admin",
    component: AdminSettingsComponent,
    canActivate: [authGuard, canAccessAutoConfirmSettings],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "clone-cipher",
    component: AddEditComponent,
    canActivate: [authGuard, restrictedCipherGuard(RestrictedCipherAction.Clone)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "add-send",
    component: SendAddEditV2Component,
    canActivate: [authGuard, filePickerPopoutGuard()],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "edit-send",
    component: SendAddEditV2Component,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "send-created",
    component: SendCreatedComponent,
    canActivate: [authGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "share-item",
    component: ShareItemComponent,
    canActivate: [authGuard, canAccessFeature(FeatureFlag.PM34203TemporaryItemSharing)],
    // Above "view-cipher"
    data: { elevation: 4 } satisfies RouteDataProperties,
  },
  {
    // Hosts the complementary Triage + Webmapper authoring tools; the `view`
    // query param selects which is shown first.
    path: "autofill-triage",
    component: AutofillToolsComponent,
    canActivate: [authGuard, autofillToolsDevFlagGuard],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "",
    component: ExtensionAnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.SignUp,
        canActivate: [unauthGuardFn()],
        data: {
          elevation: 1,
          pageTitle: {
            key: "createAccount",
          },
          showBackButton: true,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
          hideFooter: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationStartComponent,
          },
          {
            path: "",
            component: RegistrationStartSecondaryComponent,
            outlet: "secondary",
            data: {
              loginRoute: `/${AuthRoute.Login}`,
            } satisfies RegistrationStartSecondaryComponentData,
          },
        ],
      },
      {
        path: AuthRoute.FinishSignUp,
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: LockIcon,
          elevation: 1,
          showBackButton: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
        ],
      },
      {
        path: AuthRoute.SetInitialPassword,
        canActivate: [authGuard],
        component: SetInitialPasswordComponent,
        data: {
          elevation: 1,
        } satisfies RouteDataProperties,
      },
      {
        // LocalPass: a vault is created on this device, so the login screen becomes the start
        // screen. The route keeps its name so the existing guards and redirects keep working.
        path: AuthRoute.Login,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: {
          pageTitle: {
            key: "localVaultStartTitle",
          },
          elevation: 1,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: LocalVaultStartComponent }],
      },
      {
        path: "restore-vault",
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: {
          pageTitle: {
            key: "restoreVaultFromCloud",
          },
          elevation: 1,
          showBackButton: true,
          hidePageIcon: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: RestoreVaultV2Component }],
      },
      {
        path: AuthRoute.CreateLocalVault,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: {
          pageTitle: {
            key: "createLocalVault",
          },
          // After a restore-from-file the popup shows LocalPass's own import picker; the shared
          // route would open the import wizard in a separate tab.
          importRoute: "/import-source-v2",
          elevation: 1,
          showBackButton: true,
          hidePageIcon: true,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: CreateLocalVaultComponent }],
      },
      {
        path: AuthRoute.LoginWithPasskey,
        canActivate: [unauthGuardFn(unauthRouteOverrides), platformPopoutGuard(["linux"])],
        data: {
          pageTitle: {
            key: "logInWithPasskey",
          },
          elevation: 1,
          showBackButton: true,
          hidePageIcon: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          heroTextAlignment: "left",
          secondaryContentLocation: "footer",
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaWebAuthnComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.Sso,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: {
          pageIcon: VaultIcon,
          pageTitle: {
            key: "enterpriseSingleSignOn",
          },
          pageSubtitle: {
            key: "singleSignOnEnterOrgIdentifierText",
          },
          elevation: 1,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", component: SsoComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.LoginWithDevice,
        canActivate: [redirectToVaultIfUnlockedGuard()],
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "logInRequestSent",
          },
          pageSubtitle: {
            key: "aNotificationWasSentToYourDevice",
          },
          showBackButton: true,
          elevation: 1,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaAuthRequestComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.PasswordHint,
        canActivate: [unauthGuardFn(unauthRouteOverrides)],
        data: {
          pageTitle: {
            key: "requestPasswordHint",
          },
          pageSubtitle: {
            key: "enterYourAccountEmailAddressAndYourPasswordHintWillBeSentToYou",
          },
          pageIcon: UserLockIcon,
          showBackButton: true,
          elevation: 1,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          { path: "", component: PasswordHintComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
        ],
      },
      {
        path: AuthRoute.AdminApprovalRequested,
        canActivate: [redirectToVaultIfUnlockedGuard()],
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "adminApprovalRequested",
          },
          pageSubtitle: {
            key: "adminApprovalRequestSentToAdmins",
          },
          showLogo: false,
          showBackButton: true,
          elevation: 1,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: LoginViaAuthRequestComponent }],
      },
      {
        path: AuthRoute.LoginInitiated,
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
          showAcctSwitcher: true,
        } satisfies ExtensionAnonLayoutWrapperData,
        children: [{ path: "", component: LoginDecryptionOptionsComponent }],
      },
      {
        path: "lock",
        canActivate: [lockGuard()],
        data: {
          pageIcon: LockIcon,
          pageTitle: {
            key: "yourVaultIsLockedV2",
          },
          showReadonlyHostname: true,
          showAcctSwitcher: true,
          contentVerticalPadding: "compact",
          footerVerticalPadding: "compact",
          elevation: 1,
          /**
           * This ensures that in a passkey flow the `/fido2?<queryParams>` URL does not get
           * overwritten in the `BrowserRouterService` by the `/lock` route. This way, after
           * unlocking, the user can be redirected back to the `/fido2?<queryParams>` URL.
           *
           * Also, this prevents a routing loop when using biometrics to unlock the vault in MV2 (Firefox),
           * locking up the browser (https://localpass.atlassian.net/browse/PM-16116). This involves the
           * `popup-router-cache.service` pushing the `lock` route to the history.
           */
          doNotSaveUrl: true,
        } satisfies ExtensionAnonLayoutWrapperData & RouteDataProperties,
        children: [
          {
            path: "",
            component: LockComponent,
          },
        ],
      },
      {
        path: AuthRoute.TwoFactor,
        canActivate: [unauthGuardFn(unauthRouteOverrides), TwoFactorAuthGuard],
        children: [
          {
            path: "",
            component: TwoFactorAuthComponent,
          },
        ],
        data: {
          elevation: 1,
          pageTitle: {
            key: "verifyYourIdentity",
          },
          showBackButton: true,
          // `TwoFactorAuthComponent` manually sets its icon based on the 2fa type
          pageIcon: null,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
      },
      {
        path: AuthRoute.ChangePassword,
        data: {
          elevation: 1,
          hideFooter: true,
          pageIcon: LockIcon,
        } satisfies RouteDataProperties & ExtensionAnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: ChangePasswordComponent,
          },
        ],
        canActivate: [authGuard],
      },
    ],
  },
  {
    path: "assign-collections",
    component: AssignCollections,
    canActivate: [authGuard, restrictedCipherGuard(RestrictedCipherAction.AssignCollections)],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "about",
    component: AboutV2Component,
    canActivate: [authGuard],
    data: { elevation: 1, compact: true } satisfies RouteDataProperties,
  },
  {
    path: "more-from-localpass",
    component: MoreFromLocalPassPageComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "download-localpass",
    component: DownloadLocalPassComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "default-password-manager-prompt",
    component: DefaultPasswordManagerPromptComponent,
    canActivate: [],
    data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
  },
  ...featureFlaggedRoute({
    defaultComponent: ExtensionAnonLayoutWrapperComponent,
    flaggedComponent: WelcomePageComponent,
    featureFlag: FeatureFlag.PM45335_ExtensionWelcomePage,
    routeOptions: {
      path: "intro-carousel",
      canActivate: [],
      data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
      children: [
        {
          path: "",
          component: IntroCarouselComponent,
          data: {
            pageIcon: null,
            hideFooter: true,
          } satisfies ExtensionAnonLayoutWrapperData,
        },
      ],
    },
    flaggedRouteOptions: {
      path: "intro-carousel",
      canActivate: [],
      data: { elevation: 0, doNotSaveUrl: true } satisfies RouteDataProperties,
    },
  }),
  {
    path: "confirm-key-connector-domain",
    component: ExtensionAnonLayoutWrapperComponent,
    canActivate: [],
    data: { elevation: 1 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        component: ConfirmKeyConnectorDomainComponent,
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          showBackButton: true,
          pageIcon: DomainIcon,
        } satisfies ExtensionAnonLayoutWrapperData,
      },
    ],
  },
  {
    path: "tabs",
    component: TabsV2Component,
    data: { elevation: 0 } satisfies RouteDataProperties,
    children: [
      {
        path: "",
        redirectTo: "/tabs/vault",
        pathMatch: "full",
      },
      {
        path: "current",
        redirectTo: "/tabs/vault",
      },
      {
        path: "vault",
        component: VaultListV2Component,
        canActivate: [authGuard, restoreVaultScopeGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        /**
         * The vault scoped by `:vaultId`, the segment web and desktop use. Same component and elevation
         * as the unscoped route: a switch is the same page narrowed, not a push or a pop.
         */
        path: "vault/:vaultId",
        component: VaultListV2Component,
        canActivate: [authGuard, vaultScopeGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        // An organization's "My items" collection, named by a static segment — see `MY_ITEMS_ROUTE`.
        path: `vault/:vaultId/${MY_ITEMS_ROUTE}`,
        component: VaultListV2Component,
        canActivate: [authGuard, vaultScopeGuard],
        canDeactivate: [clearVaultStateGuard],
        data: { ...MY_ITEMS_ROUTE_DATA, elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "generator",
        component: GeneratorV2Component,
        canActivate: [authGuard],
        data: { elevation: 0, compact: true } satisfies RouteDataProperties,
      },
      {
        path: "generator-history-v2",
        component: GeneratorHistoryV2Component,
        canActivate: [authGuard],
        data: { elevation: 0, compact: true } satisfies RouteDataProperties,
      },
      {
        path: "settings",
        component: SettingsListV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "send",
        component: SendV2Component,
        canActivate: [authGuard],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
      {
        path: "health",
        component: HealthComponent,
        canActivate: [authGuard, canAccessHealth],
        data: { elevation: 0 } satisfies RouteDataProperties,
      },
    ],
  },
  {
    path: "health/:category",
    component: HealthRiskCategoryDetailComponent,
    canActivate: [authGuard, canAccessHealth, canAccessHealthDetail],
    data: { elevation: 1 } satisfies RouteDataProperties,
  },
  {
    path: "at-risk-passwords",
    component: AtRiskPasswordsComponent,
    canActivate: [atRiskPasswordAuthGuard, canAccessAtRiskPasswords, hasAtRiskPasswords],
  },
  {
    path: AuthExtensionRoute.AccountSwitcher,
    component: AccountSwitcherComponent,
    data: { elevation: 4, doNotSaveUrl: true } satisfies RouteDataProperties,
  },
  {
    path: "trash",
    component: TrashV2Component,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "archive",
    component: ArchiveComponent,
    canActivate: [authGuard],
    data: { elevation: 2 } satisfies RouteDataProperties,
  },
  {
    path: "security",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "phishing-warning",
        children: [
          {
            path: "",
            component: PhishingWarningComponent,
          },
          {
            path: "",
            component: ProtectedByComponent,
            outlet: "secondary",
          },
        ],
        data: {
          pageIcon: null,
          hideBackgroundIllustration: true,
          showReadonlyHostname: true,
        } satisfies AnonLayoutWrapperData,
      },
    ],
  },
];

@Injectable()
export class NoRouteReuseStrategy implements RouteReuseStrategy {
  shouldDetach(route: ActivatedRouteSnapshot) {
    return false;
  }

  // eslint-disable-next-line
  store(route: ActivatedRouteSnapshot, handle: {}) {
    /* Nothing */
  }

  shouldAttach(route: ActivatedRouteSnapshot) {
    return false;
  }

  retrieve(route: ActivatedRouteSnapshot): any {
    return null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot) {
    // The import shell is reused so its progress bar persists across its child routes. Only the
    // flagged import route carries the marker, so every other route still returns false.
    if (future.routeConfig !== curr.routeConfig) {
      return false;
    }
    // Root's routeConfig is always null; reuse it only when both sides are inside the import shell.
    if (future.routeConfig === null) {
      return (
        future.firstChild?.routeConfig?.data?.["importShell"] === true &&
        curr.firstChild?.routeConfig?.data?.["importShell"] === true
      );
    }
    return future.routeConfig.data?.["importShell"] === true;
  }
}

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      onSameUrlNavigation: "reload",
      /*enableTracing: true,*/
    }),
  ],
  exports: [RouterModule],
  providers: [{ provide: RouteReuseStrategy, useClass: NoRouteReuseStrategy }],
})
export class AppRoutingModule {}
