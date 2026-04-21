import { describe, it, expect } from 'vitest';
import { paiseToRupeesString, rupeesStringToPaise, sumPaise } from '../src/lib/money';

describe('rupeesStringToPaise', () => {
  it('converts whole rupees', () => {
    expect(rupeesStringToPaise('100')).toBe(10000n);
  });

  it('converts with 2-decimal paise', () => {
    expect(rupeesStringToPaise('100.45')).toBe(10045n);
  });

  it('pads single-decimal input to two', () => {
    expect(rupeesStringToPaise('100.5')).toBe(10050n);
  });

  it('handles zero correctly', () => {
    expect(rupeesStringToPaise('0')).toBe(0n);
    expect(rupeesStringToPaise('0.00')).toBe(0n);
  });

  it('rejects invalid input', () => {
    expect(() => rupeesStringToPaise('abc')).toThrow();
    expect(() => rupeesStringToPaise('-10')).toThrow();
    expect(() => rupeesStringToPaise('10.123')).toThrow();
    expect(() => rupeesStringToPaise('10.')).toThrow();
  });

  it('handles trim whitespace', () => {
    expect(rupeesStringToPaise('  100.5  ')).toBe(10050n);
  });
});

describe('paiseToRupeesString', () => {
  it('formats whole rupees', () => {
    expect(paiseToRupeesString(10000n)).toBe('100.00');
  });

  it('formats with fractional paise', () => {
    expect(paiseToRupeesString(10045n)).toBe('100.45');
  });

  it('pads single digit paise', () => {
    expect(paiseToRupeesString(10005n)).toBe('100.05');
  });

  it('handles zero', () => {
    expect(paiseToRupeesString(0n)).toBe('0.00');
  });

  it('handles negative values', () => {
    expect(paiseToRupeesString(-10045n)).toBe('-100.45');
  });
});

describe('sumPaise + round-trip', () => {
  it('sums without precision loss across many values', () => {
    const amounts = ['0.10', '0.20', '0.30', '99.99', '0.01'];
    const paise = amounts.map(rupeesStringToPaise);
    expect(sumPaise(paise)).toBe(10060n);
    expect(paiseToRupeesString(sumPaise(paise))).toBe('100.60');
  });

  it('survives round-trip for varied values', () => {
    for (const v of ['0.00', '0.01', '0.10', '1.00', '999999.99', '12345.67']) {
      expect(paiseToRupeesString(rupeesStringToPaise(v))).toBe(v.length === 1 ? `${v}.00` : v);
    }
  });
});
