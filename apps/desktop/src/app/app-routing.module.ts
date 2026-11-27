import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthenticationTimeoutComponent } from "@localpass/angular/auth/components/authentication-timeout.component";
import { AuthRoute } from "@localpass/angular/auth/constants";
import { EnvironmentSelectorComponent } from "@localpass/angular/auth/environment-selector/environment-selector.component";
import {
  authGuard,
  lockGuard,
  activeAuthGuard,
  redirectGuard,
  tdeDecryptionRequiredGuard,
  unauthGuardFn,
} from "@localpass/angular/auth/guards";
import {
  CreateLocalVaultComponent,
  RestoreVaultV2Component,
} from "@localpass/angular/auth/local-vault";
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
  RegistrationUserAddIcon,
  ExpiredIcon,
  EmailCodeSentIcon,
  UserLockIcon,
  VaultIcon,
  LockIcon,
  DomainIcon,
} from "@localpass/assets/svg";
import {
  LoginViaAuthRequestComponent,
  PasswordHintComponent,
  LoginDecryptionOptionsComponent,
  SsoComponent,
  TwoFactorAuthComponent,
  TwoFactorAuthGuard,
  NewDeviceVerificationComponent,
} from "@localpass/auth/angular";
import { FeatureFlag } from "@localpass/common/enums/feature-flag.enum";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "@localpass/components";
import { canActivateImportType, IMPORT_DESTINATION_ROUTE_PATH } from "@localpass/importer-ui";
import {
  LockComponent,
  ConfirmKeyConnectorDomainComponent,
  RemovePasswordComponent,
} from "@localpass/key-management-ui";
import {
  FOLDER_ID_PARAM,
  FOLDERS_ROUTE,
  MY_ITEMS_ROUTE,
  MY_ITEMS_ROUTE_DATA,
  organizationVaultGuard,
  SHARED_FOLDERS_ROUTE,
  vaultFilterLegacyRedirectGuard,
  vaultFilterRestoreGuard,
  vaultScopeGuard,
  type VaultScopeRouteData,
} from "@localpass/vault";

import { AccountSwitcherV2Component } from "../auth/components/account-switcher/account-switcher-v2.component";
import { maxAccountsGuardFn } from "../auth/guards/max-accounts.guard";
import { reactiveUnlockVaultGuard } from "../autofill/guards/reactive-vault-guard";
import { Fido2CreateComponent } from "../autofill/modal/credentials/fido2-create.component";
import { Fido2CredentialNotFoundComponent } from "../autofill/modal/credentials/fido2-credential-not-found.component";
import { Fido2ExcludedCiphersComponent } from "../autofill/modal/credentials/fido2-excluded-ciphers.component";
import { Fido2RpIdNotAllowedComponent } from "../autofill/modal/credentials/fido2-rp-id-not-allowed.component";
import { Fido2VaultComponent } from "../autofill/modal/credentials/fido2-vault.component";
import { MyFoldersComponent } from "../vault/app/my-folders/my-folders.component";
import { SharedFoldersComponent } from "../vault/app/shared-folders/shared-folders.component";
import { TrashDesktopV2Component } from "../vault/app/trash-desktop-v2/trash-desktop-v2.component";
import { VaultDesktopV2Component } from "../vault/app/vault-desktop-v2/vault-desktop-v2.component";
import { VaultComponent } from "../vault/app/vault-v3/vault.component";

import { DesktopLayoutComponent } from "./layout/desktop-layout.component";
import { LocalVaultLayoutComponent } from "./layout/local-vault-layout.component";
import { UnlockOfflineFootnoteComponent } from "./layout/unlock-offline-footnote.component";
import { SettingsDesktopV2Component } from "./settings-desktop-v2/settings-desktop-v2.component";
import { BackupStatusDesktopV2Component } from "./tools/backup/backup-status-desktop-v2.component";
import { DataSafetyDesktopV2Component } from "./tools/data-safety/data-safety-desktop-v2.component";
import { ExportDesktopV2Component } from "./tools/export/export-desktop-v2.component";
import { ImportLandingDesktopV2Component } from "./tools/import/import-landing-desktop-v2.component";
import { ImportPreviewDesktopComponent } from "./tools/import/import-preview-desktop.component";
import { ImportShellDesktopComponent } from "./tools/import/import-shell-desktop.component";
import { NetworkGateDesktopV2Component } from "./tools/network-gate/network-gate-desktop-v2.component";
import { unsavedSendEditsGuard } from "./tools/send/guards/unsaved-send-edits.guard";
import { SendComponent } from "./tools/send/send.component";

/**
 * Data properties acceptable for use in route objects in the desktop
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouteDataProperties {
  // For any new route data properties, add them here.
  // then assert that the data object satisfies this interface in the route object.
}

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [], // Children lets us have an empty component.
    canActivate: [redirectGuard({ loggedIn: "/vault", loggedOut: "/login", locked: "/lock" })],
  },
  {
    path: AuthRoute.AuthenticationTimeout,
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: "",
        component: AuthenticationTimeoutComponent,
      },
      {
        path: "",
        component: AccountSwitcherV2Component,
        outlet: "header-actions",
      },
    ],
    data: {
      pageIcon: ExpiredIcon,
      pageTitle: {
        key: "authenticationTimeout",
      },
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
  },
  {
    path: AuthRoute.NewDeviceVerification,
    component: AnonLayoutWrapperComponent,
    canActivate: [unauthGuardFn(), activeAuthGuard()],
    children: [
      { path: "", component: NewDeviceVerificationComponent },
      {
        path: "",
        component: AccountSwitcherV2Component,
        outlet: "header-actions",
      },
    ],
    data: {
      pageIcon: EmailCodeSentIcon,
      pageTitle: {
        key: "verifyYourIdentity",
      },
      pageSubtitle: {
        key: "weDontRecognizeThisDevice",
      },
    } satisfies RouteDataProperties & AnonLayoutWrapperData,
  },
  {
    path: "fido2-assertion",
    component: Fido2VaultComponent,
  },
  {
    path: "fido2-creation",
    component: Fido2CreateComponent,
  },
  {
    path: "fido2-excluded",
    component: Fido2ExcludedCiphersComponent,
  },
  {
    path: "fido2-credential-not-found",
    component: Fido2CredentialNotFoundComponent,
  },
  {
    path: "fido2-rp-id-not-allowed",
    component: Fido2RpIdNotAllowedComponent,
  },
  {
    // 桌面端建库页是整窗卡片，不套用匿名落地页的页头与背景插画。
    path: AuthRoute.CreateLocalVault,
    canActivate: [maxAccountsGuardFn()],
    component: CreateLocalVaultComponent,
    data: {
      localVaultLayout: "desktop",
    } satisfies RouteDataProperties & { localVaultLayout: "desktop" },
  },
  {
    path: "",
    component: AnonLayoutWrapperComponent,
    children: [
      {
        path: AuthRoute.SignUp,
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: RegistrationUserAddIcon,
          pageTitle: {
            key: "createAccount",
          },
        } satisfies AnonLayoutWrapperData,
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
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.FinishSignUp,
        canActivate: [unauthGuardFn()],
        data: {
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RegistrationFinishComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        // LocalPass: a vault is created on this device, so the first-run screen is the creation
        // form itself. The route keeps its name so the existing guards and redirects keep working.
        path: AuthRoute.Login,
        canActivate: [maxAccountsGuardFn()],
        data: {
          pageIcon: VaultIcon,
        },
        children: [
          { path: "", redirectTo: `/${AuthRoute.CreateLocalVault}`, pathMatch: "full" },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: "restore-vault",
        canActivate: [maxAccountsGuardFn()],
        data: {
          pageTitle: {
            key: "restoreVaultFromCloud",
          },
          pageIcon: VaultIcon,
        },
        children: [{ path: "", component: RestoreVaultV2Component }],
      },
      {
        path: AuthRoute.LoginInitiated,
        canActivate: [tdeDecryptionRequiredGuard()],
        data: {
          pageIcon: DevicesIcon,
        },
        children: [
          { path: "", component: LoginDecryptionOptionsComponent },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.Sso,
        data: {
          pageIcon: VaultIcon,
          pageTitle: {
            key: "enterpriseSingleSignOn",
          },
          pageSubtitle: {
            key: "singleSignOnEnterOrgIdentifierText",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: SsoComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.LoginWithDevice,
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "logInRequestSent",
          },
          pageSubtitle: {
            key: "aNotificationWasSentToYourDevice",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaAuthRequestComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.AdminApprovalRequested,
        data: {
          pageIcon: DevicesIcon,
          pageTitle: {
            key: "adminApprovalRequested",
          },
          pageSubtitle: {
            key: "adminApprovalRequestSentToAdmins",
          },
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: LoginViaAuthRequestComponent },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.PasswordHint,
        canActivate: [unauthGuardFn()],
        data: {
          pageTitle: {
            key: "requestPasswordHint",
          },
          pageSubtitle: {
            key: "enterYourAccountEmailAddressAndYourPasswordHintWillBeSentToYou",
          },
          pageIcon: UserLockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          { path: "", component: PasswordHintComponent },
          {
            path: "",
            component: EnvironmentSelectorComponent,
            outlet: "environment-selector",
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: "lock",
        canActivate: [lockGuard(), reactiveUnlockVaultGuard],
        data: {
          // LocalPass 的解锁页是卡片自带标题与图标的整窗布局，不再叠加匿名布局的页头。
          pageTitle: null,
          hidePageIcon: true,
          hideHeader: true,
          hideLogo: true,
          hideFooter: true,
          hideBackgroundIllustration: true,
          showReadonlyHostname: true,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: LockComponent,
          },
          {
            path: "",
            component: UnlockOfflineFootnoteComponent,
            outlet: "secondary",
          },
        ],
      },
      {
        path: AuthRoute.TwoFactor,
        canActivate: [unauthGuardFn(), TwoFactorAuthGuard],
        children: [
          {
            path: "",
            component: TwoFactorAuthComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
        data: {
          pageTitle: {
            key: "verifyYourIdentity",
          },
          // `TwoFactorAuthComponent` manually sets its icon based on the 2fa type
          pageIcon: null,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
      },
      {
        path: AuthRoute.SetInitialPassword,
        canActivate: [authGuard],
        data: {
          maxWidth: "lg",
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: SetInitialPasswordComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: AuthRoute.ChangePassword,
        canActivate: [authGuard],
        data: {
          pageIcon: LockIcon,
        } satisfies AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: ChangePasswordComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: "remove-password",
        canActivate: [authGuard],
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          pageIcon: LockIcon,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: RemovePasswordComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
      {
        path: "confirm-key-connector-domain",
        canActivate: [],
        data: {
          pageTitle: {
            key: "verifyYourOrganization",
          },
          pageIcon: DomainIcon,
        } satisfies RouteDataProperties & AnonLayoutWrapperData,
        children: [
          {
            path: "",
            component: ConfirmKeyConnectorDomainComponent,
          },
          {
            path: "",
            component: AccountSwitcherV2Component,
            outlet: "header-actions",
          },
        ],
      },
    ],
  },
  {
    // LocalPassword：方向 C 的桌面端外壳（左 rail + 右侧内容）。所有本地保险库页面
    // 都在这里，主界面不再是上游的 Bitwarden 侧栏。
    path: "",
    component: LocalVaultLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "vault",
        pathMatch: "full",
        component: VaultDesktopV2Component,
        data: { pageTitle: { key: "vault" } } satisfies RouteDataProperties,
      },
      {
        // 旧链接与书签仍可用。
        path: "vault-desktop-v2",
        pathMatch: "full",
        redirectTo: "vault",
      },
      {
        path: "folders-desktop-v2",
        component: FoldersV2Component,
        data: { pageTitle: { key: "myFolders" } } satisfies RouteDataProperties,
      },
      {
        path: "new-item-v2",
        component: NewItemV2Component,
        data: { pageTitle: { key: "newItem" } } satisfies RouteDataProperties,
      },
      {
        path: "edit-item-v2",
        component: ItemFormV2Component,
        data: { pageTitle: { key: "editItem" } } satisfies RouteDataProperties,
      },
      {
        path: "generator",
        component: GeneratorV2Component,
        data: { pageTitle: { key: "generator" } } satisfies RouteDataProperties,
      },
      {
        path: "generator-history-v2",
        component: GeneratorHistoryV2Component,
        data: { pageTitle: { key: "generatorHistory" } } satisfies RouteDataProperties,
      },
      {
        path: "export",
        component: ExportDesktopV2Component,
        data: { pageTitle: { key: "exportNoun" } } satisfies RouteDataProperties,
      },
      {
        path: "trash-desktop-v2",
        component: TrashDesktopV2Component,
        data: { pageTitle: { key: "trash" } } satisfies RouteDataProperties,
      },
      {
        path: "settings-desktop-v2",
        component: SettingsDesktopV2Component,
        data: { pageTitle: { key: "settings" } } satisfies RouteDataProperties,
      },
      {
        path: "backup-settings",
        component: BackupStatusDesktopV2Component,
        data: { pageTitle: { key: "cloudBackup" } } satisfies RouteDataProperties,
      },
      {
        path: "backup-config",
        component: BackupSettingsV2Component,
        data: {
          pageTitle: { key: "backupStorage" },
          backupView: "config",
        } satisfies RouteDataProperties,
      },
      {
        path: "restore",
        component: RestoreVaultV2Component,
        data: {
          pageTitle: { key: "restoreTitle" },
          restoreVariant: "desktop",
        } satisfies RouteDataProperties,
      },
      {
        path: "network-gate",
        component: NetworkGateDesktopV2Component,
        data: { pageTitle: { key: "networkGate" } } satisfies RouteDataProperties,
      },
      {
        path: "data-safety",
        component: DataSafetyDesktopV2Component,
        data: { pageTitle: { key: "dataAndSafety" } } satisfies RouteDataProperties,
      },
      {
        path: "import",
        pathMatch: "full",
        component: ImportLandingDesktopV2Component,
        data: { pageTitle: { key: "importNoun" } } satisfies RouteDataProperties,
      },
      {
        path: "import-preview",
        component: ImportPreviewDesktopComponent,
        data: { pageTitle: { key: "importPreviewTitle" } } satisfies RouteDataProperties,
      },
      {
        path: "import/all",
        component: ImportShellDesktopComponent,
        data: { pageTitle: { key: "importNoun" } } satisfies RouteDataProperties,
        children: [
          {
            path: "",
            pathMatch: "full",
            // Lazy load vendor icon set
            loadComponent: () =>
              import("./tools/import/import-source-select-desktop.component").then(
                (mod) => mod.ImportSourceSelectDesktopComponent,
              ),
            data: { pageTitle: { key: "importNoun" } } satisfies RouteDataProperties,
          },
          {
            path: ":importType",
            canActivate: [canActivateImportType("/import/all")],
            loadComponent: () =>
              import("./tools/import/import-controls-desktop.component").then(
                (mod) => mod.ImportControlsDesktopComponent,
              ),
            data: { pageTitle: { key: "importNoun" } } satisfies RouteDataProperties,
          },
          {
            path: IMPORT_DESTINATION_ROUTE_PATH,
            canActivate: [canActivateImportType("/import/all")],
            loadComponent: () =>
              import("./tools/import/import-destination-desktop.component").then(
                (mod) => mod.ImportDestinationDesktopComponent,
              ),
            data: { pageTitle: { key: "importNoun" } } satisfies RouteDataProperties,
          },
        ],
      },
    ],
  },
  {
    path: "",
    component: DesktopLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: "vault",
        canActivate: [vaultFilterLegacyRedirectGuard],
        data: { pageTitle: { key: "vault" } } satisfies RouteDataProperties,
        children: [
          // Filter memory hangs off the flagged route options; the same component is expected.
          ...featureFlaggedRoute({
            defaultComponent: VaultComponent,
            flaggedComponent: VaultComponent,
            featureFlag: FeatureFlag.VFO1Foundation,
            routeOptions: {
              path: "",
            },
            flaggedRouteOptions: {
              path: "",
              canActivate: [vaultFilterRestoreGuard],
              data: { vaultFilterScope: true } satisfies RouteDataProperties & VaultScopeRouteData,
            },
          }),
          {
            path: ":vaultId",
            component: VaultComponent,
            canActivate: [
              canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
              vaultScopeGuard,
              vaultFilterRestoreGuard,
            ],
            data: { vaultFilterScope: true } satisfies RouteDataProperties & VaultScopeRouteData,
          },
          // An organization's "My items" collection. A page of the vault rather than one of its
          // shared folders, so it sits alongside the list rather than under it — see
          // `MY_ITEMS_ROUTE`.
          {
            path: `:vaultId/${MY_ITEMS_ROUTE}`,
            component: VaultComponent,
            canActivate: [
              canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
              vaultScopeGuard,
              vaultFilterRestoreGuard,
            ],
            data: { ...MY_ITEMS_ROUTE_DATA, vaultFilterScope: true } satisfies RouteDataProperties &
              VaultScopeRouteData,
          },
          // An organization vault's shared folders.
          {
            path: `:vaultId/${SHARED_FOLDERS_ROUTE}`,
            component: SharedFoldersComponent,
            canActivate: [
              canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
              organizationVaultGuard,
              vaultScopeGuard,
            ],
            data: { pageTitle: { key: "sharedFolders" } } satisfies RouteDataProperties,
          },
          // The shared folder a vault has been drilled into. Drilling deeper replaces the
          // `:collectionId` segment rather than adding to it — see `vaultScopeCommands`.
          {
            path: `:vaultId/${SHARED_FOLDERS_ROUTE}/:collectionId`,
            component: VaultComponent,
            canActivate: [
              canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
              vaultScopeGuard,
              vaultFilterRestoreGuard,
            ],
            data: { vaultFilterScope: true } satisfies RouteDataProperties & VaultScopeRouteData,
          },
        ],
      },
      {
        path: "folders",
        component: MyFoldersComponent,
        canActivate: [canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault")],
        data: { pageTitle: { key: "myFolders" } } satisfies RouteDataProperties,
      },
      // One of the user's folders.
      {
        path: `${FOLDERS_ROUTE}/:${FOLDER_ID_PARAM}`,
        component: VaultComponent,
        canActivate: [
          canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault"),
          vaultScopeGuard,
          vaultFilterRestoreGuard,
        ],
        data: { vaultFilterScope: true } satisfies RouteDataProperties & VaultScopeRouteData,
      },
      {
        path: "send",
        component: SendComponent,
        data: { pageTitle: { key: "send" } } satisfies RouteDataProperties,
        canDeactivate: [unsavedSendEditsGuard],
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      useHash: true,
      // enableTracing: true,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
