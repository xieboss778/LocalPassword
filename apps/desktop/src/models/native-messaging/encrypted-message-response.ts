// eslint-disable-next-line no-restricted-imports
import { EncString } from "@localpass/legacy-crypto";

import { MessageCommon } from "./message-common";

export type EncryptedMessageResponse = MessageCommon & {
  encryptedPayload: EncString;
};
