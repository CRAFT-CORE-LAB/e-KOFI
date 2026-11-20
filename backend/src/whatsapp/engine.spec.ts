import { applyTurn, type EngineDeps, type Lookup } from './engine';
import type { Intent } from './intent';
import { blankSession, WaState, type PublicStudent, type WaSession } from './states';

const jean: PublicStudent = {
  id: 'stu-1',
  studentCode: 'EKF-2026-001',
  fullName: 'Jean Claude',
  className: 'Senior 2',
  schoolName: 'Green Hills',
  schoolId: 'sch-1',
};

const alice: PublicStudent = {
  ...jean,
  id: 'stu-2',
  studentCode: 'EKF-2026-002',
  fullName: 'Alice Uwase',
};

function session(over: Partial<WaSession> = {}): WaSession {
  return {
    ...blankSession('250788123456', new Date(), 30),
    expiresAt: new Date(Date.now() + 60_000),
    ...over,
  };
}

function deps(over: Partial<EngineDeps> = {}): EngineDeps {
  return {
    now: () => new Date(),
    sessionMinutes: 30,
    lookup: async () => ({ kind: 'missing' }),
    linkedStudents: async () => [],
    redeemLinkCode: async () => ({ ok: false, reason: 'invalid' }),
    walletBalance: async () => 1200,
    ...over,
  };
}

async function turn(state: WaSession, intent: Intent, extra?: Partial<EngineDeps>) {
  return applyTurn(state, intent, deps(extra));
}

describe('WhatsApp top-up conversation', () => {
  it('confirms an authorized student, then waits for an explicit payment confirmation', async () => {
    const found = await turn(session(), { type: 'student_id', studentCode: 'EKF-2026-001' }, {
      lookup: async () => ({ kind: 'ok', student: jean }),
    });
    expect(found.text).toContain('Jean Claude');
    expect(found.text).not.toContain('balance');
    expect(found.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);
    expect(found.effect).toBe('none');

    const yes = await turn(found.session, { type: 'yes' });
    expect(yes.effect).toBe('none');
    expect(yes.session.state).toBe(WaState.REQUESTING_AMOUNT);

    const amount = await turn(yes.session, { type: 'amount', amountRwf: 10000 });
    expect(amount.session.state).toBe(WaState.AWAITING_PAYMENT_CONFIRMATION);
    expect(amount.session.amountRwf).toBe(10000);
    expect(amount.text).toContain('9,700 RWF');
    expect(amount.effect).toBe('none');

    const confirmed = await turn(amount.session, { type: 'confirm_payment' });
    expect(confirmed.effect).toBe('initiate_payment');
    expect(confirmed.session.amountRwf).toBe(10000);
  });

  it('does not reveal a student to an unlinked WhatsApp number', async () => {
    const result = await turn(session(), { type: 'student_id', studentCode: 'EKF-2026-001' }, {
      lookup: async (): Promise<Lookup> => ({ kind: 'unauthorized', studentId: 'stu-1' }),
    });
    expect(result.text).not.toContain('Jean Claude');
    expect(result.text).toContain('No student details have been shared');
    expect(result.session.state).toBe(WaState.VERIFYING_PARENT);
    expect(result.session.studentName).toBeNull();
    expect(result.effect).toBe('none');
  });

  it('rejects an unknown student id and an out-of-range amount', async () => {
    const missing = await turn(session({ state: WaState.REQUESTING_STUDENT_ID }), {
      type: 'student_id',
      studentCode: 'NO-SUCH',
    });
    expect(missing.text).toContain('could not find');
    expect(missing.effect).toBe('none');

    const amount = await turn(
      session({
        state: WaState.REQUESTING_AMOUNT,
        studentId: jean.id,
        studentName: jean.fullName,
        studentCode: jean.studentCode,
      }),
      { type: 'amount', amountRwf: 100 },
    );
    expect(amount.text).toContain('500');
    expect(amount.session.amountRwf).toBeNull();
    expect(amount.effect).toBe('none');
  });

  it('cancels before any payment is started', async () => {
    const result = await turn(
      session({
        state: WaState.AWAITING_PAYMENT_CONFIRMATION,
        studentId: jean.id,
        studentName: jean.fullName,
        studentCode: jean.studentCode,
        amountRwf: 10000,
        payPhone: '250788123456',
      }),
      { type: 'cancel' },
    );
    expect(result.effect).toBe('none');
    expect(result.session.state).toBe(WaState.CANCELLED);
    expect(result.text).toContain('cancelled');
  });

  it('does not start a payment from an expired confirmation', async () => {
    const result = await turn(
      session({
        state: WaState.AWAITING_PAYMENT_CONFIRMATION,
        studentId: jean.id,
        studentName: jean.fullName,
        studentCode: jean.studentCode,
        amountRwf: 10000,
        payPhone: '250788123456',
        expiresAt: new Date(Date.now() - 1000),
      }),
      { type: 'confirm_payment' },
    );
    expect(result.effect).toBe('none');
    expect(result.session.state).toBe(WaState.EXPIRED);
  });

  it('supports one or several children linked to the same phone', async () => {
    const one = await turn(session(), { type: 'start' }, { linkedStudents: async () => [jean] });
    expect(one.session.studentCode).toBe('EKF-2026-001');
    expect(one.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);

    const many = await turn(session(), { type: 'start' }, { linkedStudents: async () => [jean, alice] });
    expect(many.text).toContain('EKF-2026-001');
    expect(many.text).toContain('EKF-2026-002');
    expect(many.session.studentId).toBeNull();
    expect(many.session.state).toBe(WaState.REQUESTING_STUDENT_ID);
  });

  it('shows the student only after a valid link code', async () => {
    const linked = await turn(
      session({ state: WaState.VERIFYING_PARENT, pendingStudentId: jean.id }),
      { type: 'link_code', code: '123456' },
      { redeemLinkCode: async () => ({ ok: true, student: jean }) },
    );
    expect(linked.text).toContain('Jean Claude');
    expect(linked.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);

    const rejected = await turn(
      session({ state: WaState.VERIFYING_PARENT, pendingStudentId: jean.id }),
      { type: 'link_code', code: '000000' },
      { redeemLinkCode: async () => ({ ok: false, reason: 'invalid' }) },
    );
    expect(rejected.text).not.toContain('Jean Claude');
    expect(rejected.session.studentName).toBeNull();
  });
});
