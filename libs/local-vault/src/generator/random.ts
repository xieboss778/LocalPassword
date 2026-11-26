/** 生成器共用的随机取样：拒绝采样，避免 `% n` 带来的偏斜。 */
export function randomIndex(bound: number): number {
  const limit = Math.floor(0x100000000 / bound) * bound;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % bound;
    }
  }
}
