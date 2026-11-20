import { amountInRange } from './amount';
import * as copy from './copy';
import { amountInText, nameCandidates } from './match';
import { rwandaMobileOrNull } from './phone';
import {
  clearStudent,
  rememberStudent,
  WaSession,
  WaState,
  type PublicStudent,
} from './states';
import type { Intent } from './intent';

/**
 * Any student ID can be topped up, the same as on the parent portal: money only goes
 * into the wallet. The balance is the private part, so it is shown only to WhatsApp
 * numbers the school linked to the student (a parent's, or the student's own).
 */
export type Lookup =
  | { kind: 'missing' }
  | { kind: 'inactive' }
  | { kind: 'no_wallet' }
  | { kind: 'ok'; student: PublicStudent };

export type LinkResult =
  | { ok: true; student: PublicStudent }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' | 'inactive' | 'no_wallet' };

export type EngineDeps = {
  now: () => Date;
  sessionMinutes: number;
  lookup: (studentCode: string) => Promise<Lookup>;
  /** Students the school linked to this number. These may see the balance. */
  linkedStudents: (phone: string) => Promise<PublicStudent[]>;
  /** Linked students plus students this number has already paid for. Offered first. */
  knownStudents: (phone: string) => Promise<PublicStudent[]>;
  /** Students named in the message: first and last name, plus the school unless already known to this number. */
  describe: (phone: string, text: string) => Promise<PublicStudent[]>;
  canSeeBalance: (phone: string, studentId: string) => Promise<boolean>;
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

function validAmount(amount: number | null) {
  return amount != null && amountInRange(amount) ? amount : null;
}

function confirmFound(session: WaSession, student: PublicStudent, amount: number | null): EngineResult {
  const next = {
    ...rememberStudent(session, student),
    state: WaState.AWAITING_STUDENT_CONFIRMATION,
    amountRwf: validAmount(amount),
  };
  return { session: next, text: copy.confirmStudent(student), buttons: copy.buttons.student, effect: 'none' };
}

function pickFrom(session: WaSession, students: PublicStudent[], amount: number | null, text: string): EngineResult {
  return {
    session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID, amountRwf: validAmount(amount) },
    text,
    effect: 'none',
  };
}

/** Offer the students this number is known for, or explain how to name one. */
async function offerKnown(
  session: WaSession,
  deps: EngineDeps,
  amount: number | null,
  triedName: boolean,
): Promise<EngineResult> {
  const students = await deps.knownStudents(session.waPhone);
  if (students.length === 1) {
    const next = {
      ...rememberStudent(session, students[0]),
      state: WaState.AWAITING_STUDENT_CONFIRMATION,
      amountRwf: validAmount(amount),
    };
    return {
      session: next,
      text: copy.offerStudent(
        students[0],
        next.amountRwf,
        await deps.canSeeBalance(session.waPhone, students[0].id),
      ),
      buttons: copy.buttons.offer,
      effect: 'none',
    };
  }
  if (students.length > 1) {
    return pickFrom(session, students, amount, copy.chooseChild(students));
  }
  return {
    session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID, amountRwf: validAmount(amount) },
    text: triedName ? copy.describeMissing() : copy.welcome(),
    effect: 'none',
  };
}

/** A message in plain words: find the student it names, else offer the known ones. */
async function findOrOffer(session: WaSession, text: string, deps: EngineDeps): Promise<EngineResult> {
  const amount = amountInText(text) ?? session.amountRwf;
  const namesGiven = nameCandidates(text).length >= 2;
  if (namesGiven) {
    const found = await deps.describe(session.waPhone, text);
    if (found.length === 1) return confirmFound(session, found[0], amount);
    if (found.length > 1) return pickFrom(session, found, amount, copy.chooseFound(found));
  }
  const offered = await offerKnown(session, deps, amount, false);
  if (offered.session.state === WaState.REQUESTING_STUDENT_ID && namesGiven && session.state === WaState.REQUESTING_STUDENT_ID) {
    // They were asked who the money is for and answered with a name we could not match.
    return { ...offered, text: copy.describeMissing() };
  }
  return offered;
}

async function lookupCode(
  session: WaSession,
  code: string,
  text: string,
  deps: EngineDeps,
): Promise<EngineResult> {
  const found = await deps.lookup(code);
  const amount = amountInText(text.replace(new RegExp(code.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'ig'), ' ')) ?? session.amountRwf;
  if (found.kind === 'missing') {
    if (nameCandidates(text).length >= 2) {
      const described = await deps.describe(session.waPhone, text);
      if (described.length === 1) return confirmFound(session, described[0], amount);
      if (described.length > 1) return pickFrom(session, described, amount, copy.chooseFound(described));
    }
    return {
      session: { ...session, state: WaState.REQUESTING_STUDENT_ID, pendingStudentId: null },
      text: copy.studentMissing(),
      effect: 'none',
    };
  }
  if (found.kind === 'inactive') {
    return { session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID }, text: copy.studentInactive(), effect: 'none' };
  }
  if (found.kind === 'no_wallet') {
    return { session: { ...clearStudent(session), state: WaState.REQUESTING_STUDENT_ID }, text: copy.walletMissing(), effect: 'none' };
  }
  return confirmFound(session, found.student, amount);
}

async function showBalance(current: WaSession, deps: EngineDeps): Promise<EngineResult> {
  if (!current.studentId) {
    const students = await deps.linkedStudents(current.waPhone);
    if (students.length === 0) {
      return { session: { ...current, state: WaState.REQUESTING_STUDENT_ID }, text: copy.balanceNoStudent(), effect: 'none' };
    }
    if (students.length > 1) {
      const rows: { name: string; studentCode: string; balanceRwf: number }[] = [];
      for (const student of students) {
        const balance = await deps.walletBalance(student.id);
        if (balance != null) rows.push({ name: student.fullName, studentCode: student.studentCode, balanceRwf: balance });
      }
      return { session: current, text: rows.length ? copy.balancesText(rows) : copy.walletMissing(), effect: 'none' };
    }
    current = rememberStudent(current, students[0]);
  }
  const studentId = current.studentId as string;
  if (!(await deps.canSeeBalance(current.waPhone, studentId))) {
    return {
      session: { ...current, state: WaState.VERIFYING_PARENT, pendingStudentId: studentId },
      text: copy.balanceLocked(current.studentName ?? 'this student'),
      effect: 'none',
    };
  }
  const balance = await deps.walletBalance(studentId);
  if (balance == null || !current.studentName || !current.studentCode) {
    return { session: current, text: copy.walletMissing(), effect: 'none' };
  }
  return {
    session: current,
    text: copy.balanceText(current.studentName, current.studentCode, balance),
    effect: 'none',
  };
}

function rememberedStudent(current: WaSession): PublicStudent | null {
  if (!current.studentName) return null;
  return {
    id: current.studentId ?? '',
    studentCode: current.studentCode ?? '',
    fullName: current.studentName,
    className: current.className ?? '',
    schoolName: current.schoolName ?? '',
    schoolId: current.schoolId ?? '',
  };
}

/**
 * One turn of the conversation. `text` is what they wrote, used to find a student named
 * in plain words and an amount written in the same message.
 */
export async function applyTurn(
  session: WaSession,
  intent: Intent,
  deps: EngineDeps,
  text = '',
): Promise<EngineResult> {
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
    if (current.paymentRequestId && (current.state === WaState.PAYMENT_PENDING || current.state === WaState.PAYMENT_INITIATED)) {
      return { session: current, text: copy.paymentPending(), effect: 'refresh_payment' };
    }
    return { session: current, text: 'There is no payment in progress. Send a student ID, or the full name and school, to send money.', effect: 'none' };
  }

  if (intent.type === 'balance') {
    return showBalance(current, deps);
  }

  if (intent.type === 'greet' || intent.type === 'start' || intent.type === 'unknown') {
    if (current.state === WaState.AWAITING_PAYMENT_CONFIRMATION && current.amountRwf) {
      return summary(current) ?? { session: current, text: copy.askAmount(current.studentName ?? 'the student'), effect: 'none' };
    }
    if (current.state === WaState.INITIAL || current.state === WaState.REQUESTING_STUDENT_ID) {
      return findOrOffer(current, text, deps);
    }
    if (intent.type !== 'unknown' || nameCandidates(text).length >= 2) {
      // Mid-conversation, a new name or "I want to send money" starts over with that student.
      const restarted = await findOrOffer({ ...clearStudent(current), state: WaState.INITIAL }, text, deps);
      if (restarted.session.studentId || intent.type !== 'unknown') return restarted;
    }
  }

  if (intent.type === 'student_id') {
    return lookupCode(current, intent.studentCode, text, deps);
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
    const balance = await deps.walletBalance(redeemed.student.id);
    return { session: next, text: copy.linkedNow(redeemed.student, balance), buttons: copy.buttons.offer, effect: 'none' };
  }

  if (intent.type === 'no') {
    return {
      session: { ...clearStudent(current), state: WaState.REQUESTING_STUDENT_ID },
      text: copy.askStudentId(),
      effect: 'none',
    };
  }

  if (intent.type === 'yes') {
    if (
      (current.state !== WaState.AWAITING_STUDENT_CONFIRMATION && current.state !== WaState.VERIFYING_PARENT) ||
      !current.studentId ||
      !current.studentName
    ) {
      return { session: current, text: copy.askStudentId(), effect: 'none' };
    }
    const amount = validAmount(amountInText(text) ?? current.amountRwf);
    const next = { ...current, state: WaState.REQUESTING_AMOUNT, amountRwf: amount, pendingStudentId: null };
    if (amount != null) {
      return summary(next) ?? { session: next, text: copy.askPayPhone(), effect: 'none' };
    }
    return {
      session: next,
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
      return { session: { ...current, state: WaState.REQUESTING_AMOUNT, amountRwf: null }, text: copy.invalidAmount(), effect: 'none' };
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
    if (current.state === WaState.REQUESTING_AMOUNT) {
      return { session: current, text: copy.askAmount(current.studentName ?? 'the student'), effect: 'none' };
    }
    if (current.state === WaState.AWAITING_STUDENT_CONFIRMATION) {
      const student = rememberedStudent(current);
      return {
        session: current,
        text: student ? copy.confirmStudent(student) : copy.askStudentId(),
        buttons: copy.buttons.student,
        effect: 'none',
      };
    }
    if (current.state === WaState.AWAITING_PAYMENT_CONFIRMATION) {
      return summary(current) ?? { session: current, text: copy.unrelated(), effect: 'none' };
    }
    if (current.state === WaState.VERIFYING_PARENT) {
      return { session: current, text: copy.balanceLocked(current.studentName ?? 'this student'), effect: 'none' };
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
