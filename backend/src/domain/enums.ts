export const UserRole = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  SUPERADMIN: 'SUPERADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const StudentStatus = {
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const CardStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const FingerPosition = {
  RIGHT_THUMB: 'RIGHT_THUMB',
  RIGHT_INDEX: 'RIGHT_INDEX',
  LEFT_THUMB: 'LEFT_THUMB',
  LEFT_INDEX: 'LEFT_INDEX',
  OTHER: 'OTHER',
} as const;
export type FingerPosition = (typeof FingerPosition)[keyof typeof FingerPosition];

export const FinancialEventType = {
  TEST_CREDIT: 'TEST_CREDIT',
  PARENT_TOPUP: 'PARENT_TOPUP',
  PURCHASE: 'PURCHASE',
  REVERSAL: 'REVERSAL',
  CANTEEN_WITHDRAWAL: 'CANTEEN_WITHDRAWAL',
  PLATFORM_WITHDRAWAL: 'PLATFORM_WITHDRAWAL',
} as const;
export type FinancialEventType = (typeof FinancialEventType)[keyof typeof FinancialEventType];

export const PaymentIntentStatus = {
  PENDING: 'PENDING',
  POSTED: 'POSTED',
  FAILED: 'FAILED',
} as const;
export type PaymentIntentStatus = (typeof PaymentIntentStatus)[keyof typeof PaymentIntentStatus];

export const FinancialEventStatus = {
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;
export type FinancialEventStatus = (typeof FinancialEventStatus)[keyof typeof FinancialEventStatus];

export const LedgerAccountType = {
  STUDENT_WALLET: 'STUDENT_WALLET',
  CANTEEN_ACCOUNT: 'CANTEEN_ACCOUNT',
  SYSTEM_TEST_FUND: 'SYSTEM_TEST_FUND',
  INTOUCH_PAYOUT: 'INTOUCH_PAYOUT',
  PLATFORM_FEE: 'PLATFORM_FEE',
} as const;
export type LedgerAccountType = (typeof LedgerAccountType)[keyof typeof LedgerAccountType];

export const LedgerEntrySide = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type LedgerEntrySide = (typeof LedgerEntrySide)[keyof typeof LedgerEntrySide];
