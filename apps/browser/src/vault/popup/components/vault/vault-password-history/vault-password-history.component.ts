// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first, map } from "rxjs/operators";

import { JslibModule } from "@localpass/angular/jslib.module";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { CipherId, UserId } from "@localpass/common/types/guid";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@localpass/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { PasswordHistoryViewComponent } from "@localpass/vault";

import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-password-history",
  templateUrl: "vault-password-history.component.html",
  imports: [
    JslibModule,
    PopupPageComponent,
    PopOutComponent,
    PopupHeaderComponent,
    PasswordHistoryViewComponent,
  ],
})
export class PasswordHistoryComponent implements OnInit {
  protected cipher: CipherView;
  private readonly revealedCipherService = inject(RevealedCipherService);

  constructor(
    private browserRouterHistory: PopupRouterCacheService,
    private route: ActivatedRoute,
    private cipherService: CipherService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.queryParams.pipe(first()).subscribe((params) => {
      if (params.cipherId) {
        void this.loadCipher(params.cipherId);
      } else {
        this.close();
      }
    });
  }

  close() {
    void this.browserRouterHistory.back();
  }

  /** Load the cipher based on the given Id */
  private async loadCipher(cipherId: string) {
    const activeAccount = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a: { id: string | undefined }) => a)),
    );

    if (!activeAccount?.id) {
      throw new Error("Active account is not available.");
    }

    const activeUserId = activeAccount.id as UserId;

    // A restricted cipher's history exists only in its revealed view.
    this.cipher =
      (await firstValueFrom(this.cipherService.cipherView$(activeUserId, cipherId as CipherId))) ??
      this.revealedCipherService.get(activeUserId, cipherId as CipherId);
  }
}
