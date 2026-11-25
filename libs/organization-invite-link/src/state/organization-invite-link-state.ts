import { OrganizationId } from "@localpass/common/types/guid";
import { ORGANIZATION_INVITE_LINK_MEMORY, UserKeyDefinition } from "@localpass/state";

import { OrganizationInviteLinkView } from "../models/organization-invite-link.view";

export const ORGANIZATION_INVITE_LINK_KEY = UserKeyDefinition.record<
  OrganizationInviteLinkView,
  OrganizationId
>(ORGANIZATION_INVITE_LINK_MEMORY, "inviteLink", {
  deserializer: (obj) => OrganizationInviteLinkView.fromJSON(obj),
  clearOn: ["lock", "logout"],
});
