import { amountInRange } from './amount';
import * as copy from './copy';
import { rwandaMobileOrNull } from './phone';
import {
  clearStudent,
  rememberStudent,
  WaSession,
  WaState,
  type PublicStudent,
} from './states';
import type { Intent } from './intent';

export type Lookup =
  | { kind: 'missing' }
  | { kind: 'unauthorized'; studentId: string }
  | { kind: 'inactive' }
  | { kind: 'no_wallet' }
  | { kind: 'ok'; student: PublicStudent };

export type LinkResult =
  | { ok: true; student: PublicStudent }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' | 'inactive' | 'no_wallet' };

export type EngineDeps = {
  now: () => Date;
  sessionMinutes: number;
  lookup: (phone: string, studentCode: string) => Promise<Lookup>;
  linkedStudents: (phone: string) => Promise<PublicStudent[]>;
  redeemLinkCode: (phone: string, studentId: string, code: string) => Promise<LinkResult>;
  walletBalance: (studentId: string) => Promise<number | null>;
};

export type EngineResult = {
  session: WaSession;
  text: string;
  buttons?: { id: string; title: string }[];
  effect: 'none' | 'initiate_payment' | 'refresh_payment';
};

const LINK_ATTEMPT_LIMIT = 5;

function touch(session: WaSession, now: Date, minutes: number): WaSession {
  return { ...session, expiresAt: new Date(now.getTime() + minutes * 60 * 1000) };
}

function expired(session: WaSession, now: Date) {
  return now.getTime() > session.expiresAt.getTime();
}

function payablePhone(session: WaSession) {
  if (session.payPhone && rwandaMobileOrNull(session.payPhone)) return session.payPhone;
  if (rwandaMobileOrNull(session.waPhone)) return rwandaMobileOrNull(session.waPhone);
  return null;
}

function summary(session: WaSession): EngineResult | null {
  const phone = payablePhone(session);
  if (!session.studentName || !session.studentCode || session.amountRwf == null) return null;
  if (!phone) {
    return {
      session: { ...session, state: WaState.REQUESTING_AMOUNT },
      text: copy.askPayPhone(),
      effect: 'none',
    };
  }
  return {
    session: { ...session, state: WaState.AWAITING_PAYMENT_CONFIRMATION, payPhone: phone },
    text: copy.reviewPayment({
      name: session.studentName,
      studentCode: session.studentCode,
      amountRwf: session.amountRwf,
      phone,
    }),
    buttons: copy.buttons.payment,
    effect: 'none',
  };
}

async function offerLinked(session: WaSession, deps: EngineDeps): Promise<EngineResult> {
  const students = await deps.linkedStudents(session.waPhone);
  if (students.length === 1) {
    const next = { ...rememberStudent(session, students[0]), state: WaState.AWAITING_STUDENT_CONFIRMATION };
    return { session: next, text: copy.confirmStudent(students[0]), buttons: copy.buttons.student, effect: 'none' };
  }
  if (students.length > 1) {
    return {
      session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID },
      text: copy.chooseChild(students),
      effect: 'none',
    };
  }
  return {
    session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID },
    text: copy.welcome(),
    effect: 'none',
  };
}

async function lookupCode(session: WaSession, code: string, deps: EngineDeps): Promise<EngineResult> {
  const found = await deps.lookup(session.waPhone, code);
  if (found.kind === 'missing') {
    return {
      session: { ...session, state: WaState.REQUESTING_STUDENT_ID, pendingStudentId: null },
      text: copy.studentMissing(),
      effect: 'none',
    };
  }
  if (found.kind === 'unauthorized') {
    return {
      session: {
        ...clearStudent(session),
        state: WaState.VERIFYING_PARENT,
        pendingStudentId: found.studentId,
      },
      text: copy.studentUnauthorized(),
      effect: 'none',
    };
  }
  if (found.kind === 'inactive') {
    return { session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID }, text: copy.studentInactive(), effect: 'none' };
  }
  if (found.kind === 'no_wallet') {
    return { session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID }, text: copy.walletMissing(), effect: 'none' };
  }
  const next = {
    ...rememberStudent(session, found.student),
    state: WaState.AWAITING_STUDENT_CONFIRMATION,
    amountRwf: null,
  };
  return { session: next, text: copy.confirmStudent(found.student), buttons: copy.buttons.student, effect: 'none' };
}

export async function applyTurn(session: WaSession, intent: Intent, deps: EngineDeps): Promise<EngineResult> {
  const now = deps.now();
  let current = session;
  const stale = expired(current, now);
  if (stale && current.state !== WaState.PAYMENT_PENDING && current.state !== WaState.PAYMENT_INITIATED) {
    if (intent.type === 'confirm_payment' || intent.type === 'yes') {
      return {
        session: {
          ...clearStudent(current),
          state: WaState.EXPIRED,
          amountRwf: null,
        },
        text: copy.expired(),
        effect: 'none',
      };
    }
    current = {
      ...clearStudent(current),
      state: WaState.INITIAL,
      amountRwf: null,
    };
  }

  if (
    (current.state === WaState.PAYMENT_PENDING || current.state === WaState.PAYMENT_INITIATED) &&
    intent.type !== 'status' &&
    intent.type !== 'balance' &&
    intent.type !== 'cancel'
  ) {
    return { session: touch(current, now, deps.sessionMinutes), text: copy.stillPending(), effect: 'refresh_payment' };
  }

  if (
    current.state === WaState.PAYMENT_SUCCESSFUL ||
    current.state === WaState.PAYMENT_FAILED ||
    current.state === WaState.CANCELLED ||
    current.state === WaState.EXPIRED
  ) {
    current = {
      ...clearStudent(current),
      state: WaState.INITIAL,
    };
  }

  current = touch(current, now, deps.sessionMinutes);

  if (intent.type === 'cancel') {
    if (current.state === WaState.PAYMENT_PENDING || current.state === WaState.PAYMENT_INITIATED) {
      return { session: current, text: copy.stillPending(), effect: 'refresh_payment' };
    }
    return {
      session: { ...clearStudent(current), state: WaState.CANCELLED, amountRwf: null },
      text: copy.cancelled(),
      effect: 'none',
    };
  }

  if (intent.type === 'status') {
    if (current.paymentRequestId) {
      return { session: current, text: copy.paymentPending(), effect: 'refresh_payment' };
    }
    return { session: current, text: 'There is no payment in progress. Send a student ID to start a top-up.', effect: 'none' };
  }

  if (intent.type === 'balance') {
    if (!current.studentId) {
      const students = await deps.linkedStudents(current.waPhone);
      if (students.length !== 1) {
        return { session: { ...current, state: WaState.REQUESTING_STUDENT_ID }, text: copy.askStudentId(), effect: 'none' };
      }
      current = rememberStudent(current, students[0]);
    }
    const balance = await deps.walletBalance(current.studentId as string);
    if (balance == null || !current.studentName || !current.studentCode) {
      return { session: current, text: copy.walletMissing(), effect: 'none' };
    }
    return {
      session: current,
      text: copy.balanceText(current.studentName, current.studentCode, balance),
      effect: 'none',
    };
  }

  if (intent.type === 'greet' || intent.type === 'start') {
    if (current.state === WaState.AWAITING_PAYMENT_CONFIRMATION && current.amountRwf) {
      return summary(current) ?? { session: current, text: copy.askAmount(current.studentName ?? 'the student'), effect: 'none' };
    }
    return offerLinked(current, deps);
  }

  if (intent.type === 'student_id') {
    return lookupCode(current, intent.studentCode, deps);
  }

  if (intent.type === 'link_code') {
    if (current.linkFailures >= LINK_ATTEMPT_LIMIT) {
      return { session: current, text: copy.linkLocked(), effect: 'none' };
    }
    if (!current.pendingStudentId) {
      return { session: { ...current, state: WaState.REQUESTING_STUDENT_ID }, text: copy.askStudentId(), effect: 'none' };
    }
    const redeemed = await deps.redeemLinkCode(current.waPhone, current.pendingStudentId, intent.code);
    if (!redeemed.ok) {
      if (redeemed.reason === 'inactive' || redeemed.reason === 'no_wallet') {
        return {
          session: { ...clearStudent(current), state: WaState.REQUESTING_STUDENT_ID },
          text: redeemed.reason === 'inactive' ? copy.studentInactive() : copy.walletMissing(),
          effect: 'none',
        };
      }
      return {
        session: { ...current, linkFailures: current.linkFailures + 1, state: WaState.VERIFYING_PARENT },
        text: redeemed.reason === 'locked' ? copy.linkLocked() : copy.linkFailed(),
        effect: 'none',
      };
    }
    const next = {
      ...rememberStudent(current, redeemed.student),
      state: WaState.AWAITING_STUDENT_CONFIRMATION,
    };
    return { session: next, text: copy.confirmStudent(redeemed.student), buttons: copy.buttons.student, effect: 'none' };
  }

  if (intent.type === 'no') {
    return {
      session: { ...clearStudent(current), state: WaState.REQUESTING_STUDENT_ID },
      text: 'Please send the correct student ID.',
      effect: 'none',
    };
  }

  if (intent.type === 'yes') {
    if (current.state !== WaState.AWAITING_STUDENT_CONFIRMATION || !current.studentId || !current.studentName) {
      return { session: current, text: copy.askStudentId(), effect: 'none' };
    }
    return {
      session: { ...current, state: WaState.REQUESTING_AMOUNT },
      text: copy.askAmount(current.studentName),
      effect: 'none',
    };
  }

  if (intent.type === 'pay_phone') {
    return applyPayPhone(current, intent.phone, deps);
  }

  if (intent.type === 'amount') {
    if (!current.studentId || !current.studentName || !current.studentCode) {
      return { session: { ...current, state: WaState.REQUESTING_STUDENT_ID }, text: copy.askStudentId(), effect: 'none' };
    }
    if (!amountInRange(intent.amountRwf)) {
      return { session: { ...current, state: WaState.REQUESTING_AMOUNT }, text: copy.invalidAmount(), effect: 'none' };
    }
    const next = { ...current, amountRwf: intent.amountRwf, state: WaState.REQUESTING_AMOUNT };
    return summary(next) ?? { session: next, text: copy.askPayPhone(), effect: 'none' };
  }

  if (intent.type === 'confirm_payment') {
    if (
      current.state !== WaState.AWAITING_PAYMENT_CONFIRMATION ||
      !current.studentId ||
      current.amountRwf == null ||
      !amountInRange(current.amountRwf) ||
      !payablePhone(current)
    ) {
      return { session: current, text: copy.unrelated(), effect: 'none' };
    }
    return { session: current, text: copy.paymentPrompt(current.amountRwf), effect: 'initiate_payment' };
  }

  if (intent.type === 'unknown') {
    if (current.state === WaState.REQUESTING_STUDENT_ID || current.state === WaState.INITIAL) {
      return { session: { ...current, state: WaState.REQUESTING_STUDENT_ID }, text: copy.askStudentId(), effect: 'none' };
    }
    if (current.state === WaState.REQUESTING_AMOUNT) {
      return { session: current, text: copy.askAmount(current.studentName ?? 'the student'), effect: 'none' };
    }
    if (current.state === WaState.AWAITING_STUDENT_CONFIRMATION) {
      return {
        session: current,
        text: current.studentName ? copy.confirmStudent({
          id: current.studentId ?? '',
          studentCode: current.studentCode ?? '',
          fullName: current.studentName,
          className: current.className ?? '',
          schoolName: current.schoolName ?? '',
          schoolId: current.schoolId ?? '',
        }) : copy.askStudentId(),
        buttons: copy.buttons.student,
        effect: 'none',
      };
    }
    if (current.state === WaState.AWAITING_PAYMENT_CONFIRMATION) {
      return summary(current) ?? { session: current, text: copy.unrelated(), effect: 'none' };
    }
    if (current.state === WaState.VERIFYING_PARENT) {
      return { session: current, text: copy.studentUnauthorized(), effect: 'none' };
    }
  }

  return { session: current, text: copy.unrelated(), effect: 'none' };
}

export function applyPayPhone(session: WaSession, raw: string, deps: Pick<EngineDeps, 'now' | 'sessionMinutes'>): EngineResult {
  const phone = rwandaMobileOrNull(raw);
  const current = touch(session, deps.now(), deps.sessionMinutes);
  if (!phone) {
    return { session: current, text: copy.invalidPayPhone(), effect: 'none' };
  }
  if (current.amountRwf == null || !current.studentName || !current.studentCode) {
    return {
      session: { ...current, payPhone: phone, state: current.studentId ? WaState.REQUESTING_AMOUNT : WaState.REQUESTING_STUDENT_ID },
      text: current.studentId ? copy.askAmount(current.studentName ?? 'the student') : copy.askStudentId(),
      effect: 'none',
    };
  }
  return (
    summary({ ...current, payPhone: phone }) ?? {
      session: { ...current, payPhone: phone },
      text: copy.askPayPhone(),
      effect: 'none',
    }
  );
}
