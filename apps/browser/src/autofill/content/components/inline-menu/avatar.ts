/**
 * Deterministically maps a seed string to one of three avatar tones (a, b, c).
 * Used by both account rows and TOTP rows so they share the same colour-to-account
 * mapping across both menu modes.
 */
export function getAvatarTone(seed: string): "a" | "b" | "c" {
  const tones = ["a", "b", "c"] as const;
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return tones[hash % tones.length];
}
