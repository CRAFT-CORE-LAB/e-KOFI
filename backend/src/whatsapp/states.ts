export const WaState = {
  INITIAL: 'INITIAL',
  REQUESTING_STUDENT_ID: 'REQUESTING_STUDENT_ID',
  VERIFYING_PARENT: 'VERIFYING_PARENT',
  AWAITING_STUDENT_CONFIRMATION: 'AWAITING_STUDENT_CONFIRMATION',
  REQUESTING_AMOUNT: 'REQUESTING_AMOUNT',
  AWAITING_PAYMENT_CONFIRMATION: 'AWAITING_PAYMENT_CONFIRMATION',
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SUCCESSFUL: 'PAYMENT_SUCCESSFUL',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type WaState = (typeof WaState)[keyof typeof WaState];

export const TERMINAL_STATES: WaState[] = [
  WaState.PAYMENT_SUCCESSFUL,
  WaState.PAYMENT_FAILED,
  WaState.CANCELLED,
  WaState.EXPIRED,
];

export type PublicStudent = {
  id: string;
  studentCode: string;
  fullName: string;
  className: string;
  schoolName: string;
  schoolId: string;
};

export type WaSession = {
  waPhone: string;
  state: WaState;
  revision: number;
  studentId: string | null;
  schoolId: string | null;
  studentCode: string | null;
  studentName: string | null;
  className: string | null;
  schoolName: string | null;
  pendingStudentId: string | null;
  amountRwf: number | null;
  payPhone: string | null;
  paymentAttempt: number;
  paymentRequestId: string | null;
  notifiedStatus: string | null;
  linkFailures: number;
  expiresAt: Date;
};

export function blankSession(phone: string, now: Date, minutes: number): WaSession {
  return {
    waPhone: phone,
    state: WaState.INITIAL,
    revision: 0,
    studentId: null,
    schoolId: null,
    studentCode: null,
    studentName: null,
    className: null,
    schoolName: null,
    pendingStudentId: null,
    amountRwf: null,
    payPhone: null,
    paymentAttempt: 0,
    paymentRequestId: null,
    notifiedStatus: null,
    linkFailures: 0,
    expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
  };
}

export function rememberStudent(session: WaSession, student: PublicStudent): WaSession {
  return {
    ...session,
    studentId: student.id,
    schoolId: student.schoolId,
    studentCode: student.studentCode,
    studentName: student.fullName,
    className: student.className,
    schoolName: student.schoolName,
    pendingStudentId: null,
    linkFailures: 0,
  };
}

export function clearStudent(session: WaSession): WaSession {
  return {
    ...session,
    studentId: null,
    schoolId: null,
    studentCode: null,
    studentName: null,
    className: null,
    schoolName: null,
    pendingStudentId: null,
    amountRwf: null,
    payPhone: null,
    linkFailures: 0,
  };
}
