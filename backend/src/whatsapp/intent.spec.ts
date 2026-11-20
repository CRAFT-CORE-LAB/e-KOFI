import { resolveIntent } from './intent';
import { WaState } from './states';

describe('WhatsApp intent resolution', () => {
  it('does not let a model confirm payment or invent an amount', () => {
    expect(
      resolveIntent({
        state: WaState.AWAITING_PAYMENT_CONFIRMATION,
        text: 'sounds good',
        modelAction: 'confirm_payment',
      }).type,
    ).toBe('unknown');
    expect(
      resolveIntent({
        state: WaState.REQUESTING_AMOUNT,
        text: 'please do it',
        modelAction: 'amount',
      }).type,
    ).toBe('unknown');
  });

  it('accepts an explicit button and an amount written by the parent', () => {
    expect(
      resolveIntent({
        state: WaState.AWAITING_PAYMENT_CONFIRMATION,
        text: 'Confirm payment',
        buttonId: 'confirm_payment',
      }),
    ).toEqual({ type: 'confirm_payment' });
    expect(
      resolveIntent({
        state: WaState.REQUESTING_AMOUNT,
        text: '10,000 RWF',
      }),
    ).toEqual({ type: 'amount', amountRwf: 10000 });
  });

  it('understands a top-up request without a command keyword from the model', () => {
    expect(
      resolveIntent({
        state: WaState.INITIAL,
        text: 'I want to add money to my son wallet',
        modelAction: 'start',
      }).type,
    ).toBe('start');
  });

  it('reads a student ID written next to "send money"', () => {
    expect(resolveIntent({ state: WaState.INITIAL, text: 'Send money to STU-000005' })).toEqual({
      type: 'student_id',
      studentCode: 'STU-000005',
    });
    expect(resolveIntent({ state: WaState.INITIAL, text: 'I want a top-up' }).type).toBe('start');
  });
});
