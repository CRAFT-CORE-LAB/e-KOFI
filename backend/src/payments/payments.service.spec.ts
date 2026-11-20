jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../finance/finance.service', () => ({
  FinanceService: class FinanceService {},
}));
jest.mock('../intouch/intouch.service', () => ({
  IntouchService: class IntouchService {},
}));

import { ConfigService } from '@nestjs/config';
import { PaymentIntentStatus } from '../domain/enums';
import { FinanceService } from '../finance/finance.service';
import { IntouchService } from '../intouch/intouch.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

type IntentRow = {
  id: string;
  status: string;
  requestId: string;
  studentId: string;
  grossRwf: number;
  feeRwf: number;
  studentCreditRwf: number;
  channel: string;
  idempotencyKey: string;
  payer: string;
  phone: string;
  intouchRef: string | null;
  responseCode?: string | null;
  statusDesc?: string | null;
};

function harness() {
  const intents = new Map<string, IntentRow>();
  const parentTopUp = jest.fn(async () => ({ wallet: { balanceRwf: 19700 } }));
  const readStatus = jest.fn();
  const getTransactionStatus = jest.fn();
  const configured = jest.fn(() => true);
  const prisma = {
    paymentIntent: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; requestId?: string } }) => {
        if (where.id) return intents.get(where.id) ?? null;
        if (where.requestId) {
          return [...intents.values()].find((row) => row.requestId === where.requestId) ?? null;
        }
        return null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = intents.get(where.id);
        if (!row) throw new Error('missing intent');
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<IntentRow> }) => {
        const row = intents.get(where.id);
        if (!row) throw new Error('missing intent');
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: { id: string; status?: string }; data: Partial<IntentRow> }) => {
          const row = intents.get(where.id);
          if (!row || (where.status && row.status !== where.status)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      ),
    },
    platformFeeAccount: {
      findFirst: jest.fn(async () => ({ id: 'fee', balanceRwf: 0 })),
    },
    user: {
      findUnique: jest.fn(async () => ({ id: 'actor' })),
    },
    wallet: {
      findUnique: jest.fn(async () => ({ balanceRwf: 19700 })),
    },
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    { parentTopUp } as unknown as FinanceService,
    { readStatus, getTransactionStatus, configured } as unknown as IntouchService,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { service, intents, parentTopUp, readStatus, getTransactionStatus, configured };
}

function pendingIntent(): IntentRow {
  return {
    id: 'intent-1',
    status: PaymentIntentStatus.PENDING,
    requestId: 'wa:250788123456:1',
    studentId: 'stu-1',
    grossRwf: 10000,
    feeRwf: 300,
    studentCreditRwf: 9700,
    channel: 'WHATSAPP',
    idempotencyKey: 'wa:250788123456:1',
    payer: 'parent',
    phone: '250788123456',
    intouchRef: null,
  };
}

const successStatus = {
  pending: false,
  success: true,
  failed: false,
  responseCode: '01',
  status: 'Successfull',
  transactionId: 'tx-1',
  referenceNo: null,
  statusDesc: 'Successfull',
  message: 'Transaction Successful',
};

describe('Intouch callback wallet credit', () => {
  it('credits a successful payment once and ignores a duplicate callback', async () => {
    const { service, intents, parentTopUp, getTransactionStatus } = harness();
    intents.set('intent-1', { ...pendingIntent(), intouchRef: 'tx-1' });
    getTransactionStatus.mockResolvedValue(successStatus);
    const body = { requesttransactionid: 'wa:250788123456:1', responsecode: '01' };

    await service.handleCallback(body);
    await service.handleCallback(body);

    expect(parentTopUp).toHaveBeenCalledTimes(1);
    expect(parentTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'stu-1',
        grossRwf: 10000,
        studentCreditRwf: 9700,
        idempotencyKey: 'wa:250788123456:1',
      }),
    );
    expect(intents.get('intent-1')?.status).toBe(PaymentIntentStatus.POSTED);
    expect(getTransactionStatus).toHaveBeenCalledWith('wa:250788123456:1', 'tx-1');
  });

  it('does not credit the wallet when Intouch reports a failure', async () => {
    const { service, intents, parentTopUp, getTransactionStatus } = harness();
    intents.set('intent-1', pendingIntent());
    getTransactionStatus.mockResolvedValue({
      ...successStatus,
      success: false,
      failed: true,
      responseCode: '1002',
      status: 'Failed',
      statusDesc: 'Declined',
    });

    await service.handleCallback({ requesttransactionid: 'wa:250788123456:1' });

    expect(parentTopUp).not.toHaveBeenCalled();
    expect(intents.get('intent-1')?.status).toBe(PaymentIntentStatus.FAILED);
  });

  it('does not credit the wallet from a forged success callback', async () => {
    const { service, intents, parentTopUp, getTransactionStatus } = harness();
    intents.set('intent-1', pendingIntent());
    getTransactionStatus.mockResolvedValue({ ...successStatus, success: false, pending: true, responseCode: '1000', status: 'Pending' });

    await service.handleCallback({
      requesttransactionid: 'wa:250788123456:1',
      status: 'Successfull',
      responsecode: '01',
      transactionid: 'someone-elses-tx',
    });

    expect(parentTopUp).not.toHaveBeenCalled();
    expect(intents.get('intent-1')?.status).toBe(PaymentIntentStatus.PENDING);
    expect(getTransactionStatus).toHaveBeenCalledWith('wa:250788123456:1', null);
  });

  it('does not cancel a payment from a forged failure callback', async () => {
    const { service, intents, getTransactionStatus } = harness();
    intents.set('intent-1', pendingIntent());
    getTransactionStatus.mockResolvedValue({ ...successStatus, success: false, pending: true, responseCode: '1000', status: 'Pending' });

    await service.handleCallback({ requesttransactionid: 'wa:250788123456:1', status: 'Failed', responsecode: '1002' });

    expect(intents.get('intent-1')?.status).toBe(PaymentIntentStatus.PENDING);
  });

  it('leaves the payment pending when Intouch cannot be asked', async () => {
    const { service, intents, parentTopUp, getTransactionStatus, configured } = harness();
    intents.set('intent-1', pendingIntent());
    getTransactionStatus.mockRejectedValue(new Error('Could not reach Intouch Pay.'));

    await service.handleCallback({ requesttransactionid: 'wa:250788123456:1', status: 'Successfull', responsecode: '01' });
    configured.mockReturnValue(false);
    await service.handleCallback({ requesttransactionid: 'wa:250788123456:1', status: 'Successfull', responsecode: '01' });

    expect(parentTopUp).not.toHaveBeenCalled();
    expect(intents.get('intent-1')?.status).toBe(PaymentIntentStatus.PENDING);
  });
});
