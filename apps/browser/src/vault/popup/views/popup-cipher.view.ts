import { CollectionView } from "@localpass/common/admin-console/models/collections";
import { Organization } from "@localpass/common/admin-console/models/domain/organization";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { CipherListView } from "@localpass/sdk-internal";

interface CommonPopupCipherView {
  collections?: CollectionView[];
  organization?: Organization;
}

/** Extended view for the popup based off of `CipherView`  */
interface PopupCipherView extends CipherView, CommonPopupCipherView {}

/** Extended view for the popup based off of `CipherListView` from the SDK. */
interface PopupCipherListView extends CipherListView, CommonPopupCipherView {}

export type PopupCipherViewLike = PopupCipherListView | PopupCipherView;
