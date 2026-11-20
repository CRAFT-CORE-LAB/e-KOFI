import { BadRequestException } from '@nestjs/common';

type Sql = [string, ...unknown[]];

type BatchDb = {
  prepare(query: string): { bind(...values: unknown[]): unknown };
  batch(statements: unknown[]): Promise<unknown[]>;
};

export function ekofiD1(): BatchDb | undefined {
  return (globalThis as { __EKOF_D1?: BatchDb }).__EKOF_D1;
}

export function usingD1(): boolean {
  return Boolean(ekofiD1());
}

export async function runBatch(statements: Sql[], insufficient = 'Insufficient balance'): Promise<void> {
  const db = ekofiD1();
  if (!db) {
    throw new Error('D1 binding is missing');
  }
  const prepared = statements.map(([sql, ...args]) => db.prepare(sql).bind(...args));
  try {
    await db.batch(prepared);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/CHECK constraint failed/i.test(message)) {
      throw new BadRequestException(insufficient);
    }
    if (/UNIQUE constraint failed/i.test(message)) {
      const unique = new Error(message);
      (unique as Error & { code: string }).code = 'UNIQUE';
      throw unique;
    }
    throw error;
  }
}

export function isUniqueError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'UNIQUE');
}

/** The guard row must be written immediately after the update it checks. */
export function checkedUpdate(sql: string, ...args: unknown[]): Sql[] {
  return [
    [sql, ...args],
    [
      `INSERT INTO "_SqlGuard" ("id", "ok") VALUES (1, CASE WHEN changes() = 1 THEN 1 ELSE 0 END)`,
    ],
  ];
}

export function checkedUpdateAgain(sql: string, ...args: unknown[]): Sql[] {
  return [
    [sql, ...args],
    [
      `UPDATE "_SqlGuard" SET "ok" = CASE WHEN changes() = 1 THEN 1 ELSE 0 END WHERE "id" = 1`,
    ],
  ];
}

export function clearGuard(): Sql {
  return [`DELETE FROM "_SqlGuard" WHERE "id" = 1`];
}

export async function deleteStudentGraph(studentId: string): Promise<void> {
  await runBatch([
    [`UPDATE "WhatsAppConversation" SET "studentId" = NULL WHERE "studentId" = ?`, studentId],
    [`UPDATE "WhatsAppConversation" SET "pendingStudentId" = NULL WHERE "pendingStudentId" = ?`, studentId],
    [`DELETE FROM "StudentGuardian" WHERE "studentId" = ?`, studentId],
    [`DELETE FROM "GuardianLinkCode" WHERE "studentId" = ?`, studentId],
    [`UPDATE "NfcCard" SET "replacedById" = NULL WHERE "studentId" = ?`, studentId],
    [`DELETE FROM "FingerprintTemplate" WHERE "studentId" = ?`, studentId],
    [`DELETE FROM "NfcCard" WHERE "studentId" = ?`, studentId],
    [`DELETE FROM "Wallet" WHERE "studentId" = ?`, studentId],
    [`DELETE FROM "Student" WHERE "id" = ?`, studentId],
  ]);
}
