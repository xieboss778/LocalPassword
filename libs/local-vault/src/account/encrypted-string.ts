/** `EncString` 与纯字符串两种入参，最终都只保留 `encryptedString`。 */
export function encryptedStringOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const encrypted = (value as { encryptedString?: string } | null)?.encryptedString;
  return encrypted ?? "";
}
