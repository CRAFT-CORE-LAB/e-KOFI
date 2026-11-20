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
    knownStudents: async () => [],
    describe: async () => [],
    canSeeBalance: async () => false,
    redeemLinkCode: async () => ({ ok: false, reason: 'invalid' }),
    walletBalance: async () => 1200,
    ...over,
  };
}

async function turn(state: WaSession, intent: Intent, extra?: Partial<EngineDeps>, text = '') {
  return applyTurn(state, intent, deps(extra), text);
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

  it('lets any number top up by student ID but keeps the balance for linked numbers', async () => {
    const found = await turn(session(), { type: 'student_id', studentCode: 'EKF-2026-001' }, {
      lookup: async (): Promise<Lookup> => ({ kind: 'ok', student: jean }),
    });
    expect(found.text).toContain('Jean Claude');
    expect(found.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);

    const balance = await turn(found.session, { type: 'balance' }, { canSeeBalance: async () => false });
    expect(balance.text).not.toContain('1,200');
    expect(balance.session.state).toBe(WaState.VERIFYING_PARENT);
    expect(balance.session.pendingStudentId).toBe(jean.id);

    const linked = await turn(found.session, { type: 'balance' }, { canSeeBalance: async () => true });
    expect(linked.text).toContain('1,200 RWF');
  });

  it('finds a student from a name and school, with the amount from the same message', async () => {
    const text = 'Send 5,000 to Jean Claude at Green Hills';
    const found = await turn(session(), { type: 'start' }, {
      describe: async (_phone, said) => (said === text ? [jean] : []),
    }, text);
    expect(found.text).toContain('Jean Claude');
    expect(found.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);
    expect(found.session.amountRwf).toBe(5000);

    const yes = await turn(found.session, { type: 'yes' }, {}, 'Yes');
    expect(yes.session.state).toBe(WaState.AWAITING_PAYMENT_CONFIRMATION);
    expect(yes.text).toContain('5,000 RWF');
    expect(yes.effect).toBe('none');
  });

  it('says so when a described student is not found, without guessing', async () => {
    const result = await turn(
      session({ state: WaState.REQUESTING_STUDENT_ID }),
      { type: 'unknown' },
      {},
      'Keza Uwase, Green Hills',
    );
    expect(result.text).toContain('could not find');
    expect(result.session.studentId).toBeNull();
  });

  it('offers the student a known number has paid for, and takes a bare amount as yes', async () => {
    const offered = await turn(session(), { type: 'greet' }, { knownStudents: async () => [jean] }, 'Hello');
    expect(offered.text).toContain('Would you like to send money to Jean Claude');
    expect(offered.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);

    const amount = await turn(offered.session, { type: 'yes' }, {}, '3000');
    expect(amount.session.state).toBe(WaState.AWAITING_PAYMENT_CONFIRMATION);
    expect(amount.session.amountRwf).toBe(3000);
  });

  it('lists every linked child balance when asked without naming one', async () => {
    const result = await turn(session(), { type: 'balance' }, {
      linkedStudents: async () => [jean, alice],
      walletBalance: async (id) => (id === jean.id ? 1200 : 800),
    });
    expect(result.text).toContain('Jean Claude (EKF-2026-001): 1,200 RWF');
    expect(result.text).toContain('Alice Uwase (EKF-2026-002): 800 RWF');
  });

  it('tells an unlinked number how to get balance access', async () => {
    const result = await turn(session(), { type: 'balance' });
    expect(result.text).toContain('not linked');
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
    const one = await turn(session(), { type: 'start' }, { knownStudents: async () => [jean] });
    expect(one.session.studentCode).toBe('EKF-2026-001');
    expect(one.session.state).toBe(WaState.AWAITING_STUDENT_CONFIRMATION);

    const many = await turn(session(), { type: 'start' }, { knownStudents: async () => [jean, alice] });
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
