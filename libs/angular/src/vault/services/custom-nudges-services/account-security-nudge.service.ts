import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { OrganizationService } from "@localpass/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@localpass/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@localpass/common/admin-console/enums";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import { UserId } from "@localpass/common/types/guid";
import { BiometricStateService } from "@localpass/key-management";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AccountSecurityNudgeService extends DefaultSingleNudgeService {
  private accountService = inject(AccountService);
  private pinService = inject(PinServiceAbstraction);
  private biometricStateService = inject(BiometricStateService);
  private policyService = inject(PolicyService);
  private organizationService = inject(OrganizationService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = this.accountService.accounts$.pipe(
      map((accounts) => accounts[userId]?.creationDate ?? new Date()),
    );

    return combineLatest([
      profileDate$,
      this.getNudgeStatus$(nudgeType, userId),
      of(Date.now() - THIRTY_DAYS_MS),
      from(this.pinService.isPinSet(userId)),
      this.biometricStateService.biometricUnlockEnabled$(userId),
      this.organizationService.organizations$(userId),
      this.policyService.policiesByType$(PolicyType.RemoveUnlockWithPin, userId),
    ]).pipe(
      switchMap(
        async ([
          profileCreationDate,
          status,
          profileCutoff,
          isPinSet,
          biometricUnlockEnabled,
          organizations,
          policies,
        ]) => {
          const profileOlderThanCutoff = profileCreationDate.getTime() < profileCutoff;

          const hasOrgWithRemovePinPolicyOn = organizations.some((org) => {
            return policies.some(
              (p) => p.type === PolicyType.RemoveUnlockWithPin && p.organizationId === org.id,
            );
          });

          const hideNudge =
            profileOlderThanCutoff ||
            isPinSet ||
            biometricUnlockEnabled ||
            hasOrgWithRemovePinPolicyOn;

          const acctSecurityNudgeStatus = {
            hasBadgeDismissed: status.hasBadgeDismissed || hideNudge,
            hasSpotlightDismissed: status.hasSpotlightDismissed || hideNudge,
          };

          if (
            (isPinSet || biometricUnlockEnabled || hasOrgWithRemovePinPolicyOn) &&
            !status.hasSpotlightDismissed
          ) {
            await this.setNudgeStatus(nudgeType, acctSecurityNudgeStatus, userId);
          }
          return acctSecurityNudgeStatus;
        },
      ),
    );
  }
}
