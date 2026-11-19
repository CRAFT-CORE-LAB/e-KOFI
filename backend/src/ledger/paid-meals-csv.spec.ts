import { toPaidMealsCsv } from './paid-meals-csv';

describe('toPaidMealsCsv', () => {
  it('lists paid canteen meals and a total, with commas escaped', () => {
    const csv = toPaidMealsCsv([
      {
        createdAt: new Date('2026-11-10T08:15:00.000Z'),
        studentCode: 'ST-1',
        studentName: 'Keza, Aline',
        canteenName: 'Main canteen',
        amountRwf: 1500,
        description: 'Lunch',
        recordedBy: 'Cashier',
      },
      {
        createdAt: new Date('2026-11-10T10:00:00.000Z'),
        studentCode: 'ST-2',
        studentName: 'Mugisha Eric',
        canteenName: 'Main canteen',
        amountRwf: 800,
        description: 'Snack',
        recordedBy: 'Cashier',
      },
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Date,Student ID,Student name,Canteen,Amount RWF,Status,Description,Recorded by');
    expect(csv).toContain('"Keza, Aline"');
    expect(csv).toContain('ST-1');
    expect(csv).toContain(',Paid,');
    expect(csv).toContain('Total,2300');
    expect(csv).toContain('2026-11-10 10:15');
    expect(csv).toContain('2026-11-10 12:00');
  });
});
