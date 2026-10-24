export function assertPositiveRwf(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer RWF value');
  }
}

export function formatRwf(amount: number): string {
  return `${amount.toLocaleString('en-RW')} RWF`;
}
