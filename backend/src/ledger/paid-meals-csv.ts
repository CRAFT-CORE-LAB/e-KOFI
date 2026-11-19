export type PaidMealRow = {
  createdAt: Date;
  studentCode: string;
  studentName: string;
  canteenName: string;
  amountRwf: number;
  description: string;
  recordedBy: string;
};

const kigaliDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kigali',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatKigali(date: Date) {
  const parts = kigaliDateTime.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function cell(value: string | number) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toPaidMealsCsv(rows: PaidMealRow[]) {
  const header = ['Date', 'Student ID', 'Student name', 'Canteen', 'Amount RWF', 'Status', 'Description', 'Recorded by'];
  const lines = [header.map(cell).join(',')];
  let total = 0;
  for (const row of rows) {
    total += row.amountRwf;
    lines.push(
      [
        formatKigali(row.createdAt),
        row.studentCode,
        row.studentName,
        row.canteenName,
        row.amountRwf,
        'Paid',
        row.description,
        row.recordedBy,
      ]
        .map(cell)
        .join(','),
    );
  }
  lines.push(['', '', '', 'Total', total, '', '', ''].map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
