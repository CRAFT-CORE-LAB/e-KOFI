export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CASHIER';
};

export type School = {
  id: string;
  name: string;
  classes: SchoolClass[];
};

export type SchoolClass = {
  id: string;
  name: string;
  schoolId: string;
};

export type Student = {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  pinEnabled: boolean;
  hasPin?: boolean;
  school: { id: string; name: string };
  class: { id: string; name: string };
  wallet?: { id: string; balanceRwf: number };
  cards?: Card[];
};

export type Card = {
  id: string;
  cardUid: string;
  status: 'ACTIVE' | 'BLOCKED';
  blockedReason?: string | null;
  student?: Student;
  studentId: string;
};

export type Canteen = {
  id: string;
  name: string;
  isActive: boolean;
  school: { id: string; name: string };
  account?: { id: string; balanceRwf: number };
  history?: LedgerEvent[];
};

export type LedgerEntry = {
  id: string;
  accountType: string;
  side: 'DEBIT' | 'CREDIT';
  amountRwf: number;
};

export type LedgerEvent = {
  id: string;
  type: 'TEST_CREDIT' | 'PURCHASE' | 'REVERSAL';
  status: 'POSTED' | 'REVERSED';
  amountRwf: number;
  description?: string | null;
  createdAt: string;
  student?: { studentCode: string; firstName: string; lastName: string } | null;
  canteen?: { name: string } | null;
  entries: LedgerEntry[];
  createdBy?: { name: string };
};

export type DashboardStats = {
  students: number;
  activeStudents: number;
  canteens: number;
  activeCards: number;
  postedPurchases: number;
  purchaseVolumeRwf: number;
  recent: LedgerEvent[];
};
