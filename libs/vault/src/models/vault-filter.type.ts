import { CollectionAdminView } from "@localpass/common/admin-console/models/collections";
import { Organization } from "@localpass/common/admin-console/models/domain/organization";
import { CipherType } from "@localpass/common/vault/enums";
import { ITreeNodeObject } from "@localpass/common/vault/models/domain/tree-node";
import { FolderView } from "@localpass/common/vault/models/view/folder.view";
import { LocalPassIcon } from "@localpass/components";

export type CipherStatus = "all" | "favorites" | "archive" | "trash" | CipherType;

export type CipherTypeFilter = ITreeNodeObject & { type: CipherStatus; icon?: LocalPassIcon };
/**
 * A node of the "Controlled access" group. Its ids and names come from the host that fills the
 * controlled-access seam; this library only routes the selected id back out.
 */
export type ControlledAccessFilter = ITreeNodeObject & { icon?: LocalPassIcon };

export type CollectionFilter = CollectionAdminView & {
  icon?: LocalPassIcon;
};
export type FolderFilter = FolderView & {
  icon?: LocalPassIcon;
  /**
   * Full folder name.
   *
   * Used for when the folder `name` property is be separated into parts.
   */
  fullName?: string;
};
export type OrganizationFilter = Organization & { icon?: LocalPassIcon; hideOptions?: boolean };
