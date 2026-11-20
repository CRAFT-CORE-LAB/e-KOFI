import { amountInRange, parseAmountRwf, TOPUP_MAX_RWF, TOPUP_MIN_RWF } from './amount';

describe('top-up amounts', () => {
  it('reads grouped Rwandan amounts from a parent message', () => {
    expect(parseAmountRwf('10,000 RWF')).toEqual({ ok: true, value: 10000 });
    expect(parseAmountRwf('10.000')).toEqual({ ok: true, value: 10000 });
    expect(parseAmountRwf('Can I deposit 5,000?')).toEqual({ ok: true, value: 5000 });
    expect(parseAmountRwf('5k')).toEqual({ ok: true, value: 5000 });
    expect(parseAmountRwf('ten thousand')).toEqual({ ok: true, value: 10000 });
  });

  it('rejects fractions and enforces the existing portal limits', () => {
    expect(parseAmountRwf('10.50')).toEqual({ ok: false });
    expect(parseAmountRwf('hello')).toEqual({ ok: false });
    expect(amountInRange(TOPUP_MIN_RWF - 1)).toBe(false);
    expect(amountInRange(TOPUP_MIN_RWF)).toBe(true);
    expect(amountInRange(TOPUP_MAX_RWF)).toBe(true);
    expect(amountInRange(TOPUP_MAX_RWF + 1)).toBe(false);
    expect(amountInRange(10.5)).toBe(false);
  });
});
