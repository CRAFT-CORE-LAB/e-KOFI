export function splitGross(grossRwf: number) {
  const feeRwf = Math.floor((grossRwf * 3) / 100);
  return { feeRwf, studentCreditRwf: grossRwf - feeRwf };
}
