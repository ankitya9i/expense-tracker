/**
 * Money is stored as integer paise to avoid floating-point drift.
 * Public API exchanges rupees as fixed-2 decimal strings (e.g. "123.45").
 */

const PAISE_PER_RUPEE = 100n;

export function rupeesStringToPaise(input: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid amount: "${input}". Expected format like "123" or "123.45".`);
  }
  const [, whole, fraction = ''] = match;
  const paddedFraction = fraction.padEnd(2, '0');
  return BigInt(whole) * PAISE_PER_RUPEE + BigInt(paddedFraction);
}

export function paiseToRupeesString(paise: bigint): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = abs / PAISE_PER_RUPEE;
  const fraction = abs % PAISE_PER_RUPEE;
  const fractionStr = fraction.toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fractionStr}`;
}

export function sumPaise(values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, 0n);
}
