import { Jsonify } from "type-fest";

import {
  GENERATOR_DISK,
  GENERATOR_MEMORY,
  UserKeyDefinition,
} from "@localpass/common/platform/state";
import { BufferedKeyDefinition } from "@localpass/common/tools/state/buffered-key-definition";
import { SecretClassifier } from "@localpass/common/tools/state/secret-classifier";
import { SecretKeyDefinition } from "@localpass/common/tools/state/secret-key-definition";

import { GeneratedCredential } from "./generated-credential";
import { GeneratedPasswordHistory } from "./generated-password-history";
import { LegacyPasswordHistoryDecryptor } from "./legacy-password-history-decryptor";

/**
 * 旧版加密落盘历史。
 *
 * 当前生成历史只驻留内存（见 {@link GENERATOR_HISTORY_MEMORY}），服务不再读写这里；
 * 保留定义以兼容旧版本留下的清除事件票据与迁移测试。
 */
export const GENERATOR_HISTORY = SecretKeyDefinition.array(
  GENERATOR_DISK,
  "localGeneratorHistory",
  SecretClassifier.allSecret<GeneratedCredential>(),
  {
    deserializer: GeneratedCredential.fromJSON,
    // 生成历史是明文密码：锁库即清空，不等到退出登录。
    clearOn: ["logout", "lock"],
  },
);

/**
 * 当前解锁会话的生成历史。
 *
 * 历史只驻留内存：不写磁盘、不参与同步，锁库/退出时由状态框架自动清除。
 * 生成值本身是一次性辅助数据，没有跨会话保留的必要。
 */
export const GENERATOR_HISTORY_MEMORY = UserKeyDefinition.array<GeneratedCredential>(
  GENERATOR_MEMORY,
  "localGeneratorHistory",
  {
    deserializer: GeneratedCredential.fromJSON,
    clearOn: ["logout", "lock"],
  },
);

/** encrypted password generation history subject to migration */
export const GENERATOR_HISTORY_BUFFER = new BufferedKeyDefinition<
  GeneratedPasswordHistory[],
  GeneratedCredential[],
  LegacyPasswordHistoryDecryptor
>(GENERATOR_DISK, "localGeneratorHistoryBuffer", {
  deserializer(history) {
    const items = history as Jsonify<GeneratedPasswordHistory>[];
    return items?.map((h) => new GeneratedPasswordHistory(h.password, h.date));
  },
  async isValid(history) {
    return history.length ? true : false;
  },
  async map(history, decryptor) {
    const credentials = await decryptor.decrypt(history);
    const mapped = credentials.map((c) => new GeneratedCredential(c.password, "password", c.date));
    return mapped;
  },
  clearOn: ["logout", "lock"],
});
