/** Mirrors the server rule: all-same or straight-run PINs are refused. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = pin.split("").map(Number);
  const up = d.every((v, i) => i === 0 || v === d[i - 1] + 1);
  const down = d.every((v, i) => i === 0 || v === d[i - 1] - 1);
  return up || down;
}

/** null = fine, otherwise a message. */
export function validateSecret(mode: "pin" | "password", a: string, b: string): string | null {
  if (mode === "pin") {
    if (!/^\d{6}$/.test(a)) return "The PIN must be exactly 6 digits.";
    if (isWeakPin(a)) return "That PIN is too easy to guess. Avoid repeats like 111111 and runs like 123456.";
    if (a !== b) return "The two PINs do not match.";
    return null;
  }
  if (a.length < 12) return "The password must be at least 12 characters.";
  if (a !== b) return "The two passwords do not match.";
  return null;
}