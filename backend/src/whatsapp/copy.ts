import { splitGross } from '../payments/fee';
import { TOPUP_MAX_RWF, TOPUP_MIN_RWF } from './amount';
import type { PublicStudent } from './states';

export function rwf(amount: number) {
  return `${amount.toLocaleString('en-US')} RWF`;
}

export const buttons = {
  student: [
    { id: 'confirm_student', title: 'Yes, confirm' },
    { id: 'reject_student', title: 'No, try again' },
  ],
  offer: [
    { id: 'confirm_student', title: 'Yes, send money' },
    { id: 'reject_student', title: 'No' },
  ],
  payment: [
    { id: 'confirm_payment', title: 'Confirm payment' },
    { id: 'cancel_payment', title: 'Cancel payment' },
  ],
};

export function welcome() {
  return [
    "Hello! This is e-KOFI on Shaka. I can send money to a student's e-KOFI school wallet.",
    '',
    "Tell me who it is for: the student ID from the school card, or the student's full name and school.",
    'For example: "Send 5,000 to Keza Uwase at Green Hills Academy".',
  ].join('\n');
}

export function askStudentId() {
  return "Please send the student ID from the school card, or the student's full name and school.";
}

export function describeMissing() {
  return 'I could not find that student. Check the spelling of the first and last name and include the school name, or send the student ID from the school card.';
}

/** `linked`: the school linked this number. Otherwise it is a number that paid for the student before. */
export function offerStudent(student: PublicStudent, amountRwf: number | null, linked: boolean) {
  const first = student.fullName.split(' ')[0] || student.fullName;
  const what = amountRwf ? `${rwf(amountRwf)} to ${student.fullName}` : `money to ${student.fullName}`;
  const who = `${student.fullName} (${student.className}, ${student.schoolName})`;
  return [
    linked
      ? `Hello! This WhatsApp number is linked to ${who} on e-KOFI.`
      : `Hello! Last time you sent money to ${who} on e-KOFI.`,
    '',
    `Would you like to send ${what}'s wallet?`,
    '',
    linked
      ? `To pay for someone else, send their student ID, or their full name and school. Ask "balance" to see ${first}'s balance.`
      : 'To pay for someone else, send their student ID, or their full name and school.',
  ].join('\n');
}

export function chooseFound(students: PublicStudent[]) {
  const lines = students.map(
    (student) => `${student.fullName} · ${student.className} · ${student.schoolName} · ${student.studentCode}`,
  );
  return `I found more than one student with that name:\n\n${lines.join('\n')}\n\nReply with the student ID of the one you mean.`;
}

export function balanceLocked(name: string) {
  return `Only WhatsApp numbers the school has linked to ${name} can see the balance. Send the 6-digit link code from the school, or ask the school to link this number. You can still send money to the wallet.`;
}

export function balanceNoStudent() {
  return 'This WhatsApp number is not linked to a student yet, so I cannot show a balance. Ask the school to link this number to the student (a student can have their own number linked too). You can still send money: send the student ID, or the full name and school.';
}

export function balancesText(rows: { name: string; studentCode: string; balanceRwf: number }[]) {
  const lines = rows.map((row) => `${row.name} (${row.studentCode}): ${rwf(row.balanceRwf)}`);
  return `e-KOFI wallet balances:\n\n${lines.join('\n')}`;
}

export function linkedNow(student: PublicStudent, balanceRwf: number | null) {
  return [
    `This WhatsApp number is now linked to ${student.fullName} (${student.className}, ${student.schoolName}).`,
    ...(balanceRwf == null ? [] : [`Balance: ${rwf(balanceRwf)}.`]),
    '',
    'Would you like to send money to the wallet?',
  ].join('\n');
}

export function studentMissing() {
  return 'We could not find a student with that ID. Check the number and try again.';
}

export function studentUnauthorized() {
  return 'This WhatsApp number is not allowed to view that student. Enter the 6-digit link code from your school, or ask the school to register this phone. No student details have been shared.';
}

export function studentInactive() {
  return 'This student wallet is not active. Please contact the school.';
}

export function walletMissing() {
  return 'This student does not have a wallet yet. Please contact the school.';
}

export function confirmStudent(student: PublicStudent) {
  return [
    'I found the following student:',
    '',
    `Student Name: ${student.fullName}`,
    `Class: ${student.className}`,
    `School: ${student.schoolName}`,
    `Student ID: ${student.studentCode}`,
    '',
    'Is this your child?',
  ].join('\n');
}

export function chooseChild(students: PublicStudent[]) {
  const lines = students.map(
    (student) => `${student.fullName} · ${student.className} · ${student.studentCode}`,
  );
  return `I can help with these students linked to your WhatsApp number:\n\n${lines.join('\n')}\n\nReply with the student ID you want to top up.`;
}

export function askAmount(name: string) {
  return `How much would you like to deposit into ${name}'s wallet? Enter an amount between ${rwf(TOPUP_MIN_RWF)} and ${rwf(TOPUP_MAX_RWF)}.`;
}

export function invalidAmount() {
  return `Enter an amount between ${rwf(TOPUP_MIN_RWF)} and ${rwf(TOPUP_MAX_RWF)}.`;
}

export function askPayPhone() {
  return 'What MTN or Airtel Rwanda number should receive the payment prompt? Use the number that will approve the mobile money request.';
}

export function invalidPayPhone() {
  return 'Enter a valid MTN or Airtel Rwanda number, for example 0781234567.';
}

export function reviewPayment(input: {
  name: string;
  studentCode: string;
  amountRwf: number;
  phone: string;
}) {
  const split = splitGross(input.amountRwf);
  return [
    'Please review your wallet top-up:',
    '',
    `Student: ${input.name}`,
    `Student ID: ${input.studentCode}`,
    `You pay: ${rwf(input.amountRwf)}`,
    `Student receives: ${rwf(split.studentCreditRwf)}`,
    `Service fee: ${rwf(split.feeRwf)}`,
    `Mobile money: ${input.phone}`,
    '',
    'Would you like to proceed?',
  ].join('\n');
}

export function paymentPrompt(amountRwf: number) {
  return `Your payment request for ${rwf(amountRwf)} has been initiated. Please complete the payment authorization on your phone. We will message you when it is confirmed.`;
}

export function paymentSuccess(input: {
  grossRwf: number;
  studentCreditRwf: number;
  feeRwf: number;
  name: string;
  studentCode: string;
}) {
  return [
    'Payment Successful!',
    '',
    `Your payment of ${rwf(input.grossRwf)} has been received.`,
    '',
    `Student: ${input.name}`,
    `Student ID: ${input.studentCode}`,
    '',
    `${rwf(input.studentCreditRwf)} has been credited to the student's e-KOFI wallet. Service fee: ${rwf(input.feeRwf)}.`,
    '',
    'Thank you for using e-KOFI!',
  ].join('\n');
}

export function paymentFailed(amountRwf: number) {
  return [
    'Payment Unsuccessful.',
    '',
    `Unfortunately, your payment of ${rwf(amountRwf)} could not be completed.`,
    '',
    "Your student's wallet has not been credited.",
    '',
    'This usually means the prompt on the phone was not approved in time, was declined, or the Mobile Money balance was too low.',
    '',
    'Send "hi" to try again, or contact your school administrator if you need assistance.',
  ].join('\n');
}

export function paymentNotStarted(amountRwf: number) {
  return [
    `We could not start the mobile money request for ${rwf(amountRwf)} right now. No money was taken and the wallet was not changed.`,
    '',
    'Please try again later. If it keeps happening, contact the school.',
  ].join('\n');
}

export function paymentPending() {
  return 'Your payment is still being processed. We will notify you once the payment status is confirmed.';
}

export function cancelled() {
  return 'The top-up has been cancelled. No payment was started. Send a message when you want to begin again.';
}

export function expired() {
  return 'This conversation has expired, so the previous top-up was not started. Send the student ID, or the full name and school, to begin again.';
}

export function linkFailed() {
  return 'That link code is not valid. Ask your school for a new code, or check the code and try again.';
}

export function linkLocked() {
  return 'Too many incorrect link codes. Please wait and ask your school for a new code.';
}

export function balanceText(name: string, studentCode: string, balanceRwf: number) {
  return `${name} (${studentCode}) has ${rwf(balanceRwf)} available on the e-KOFI wallet.`;
}

export function unrelated() {
  return "I can send money to a student's e-KOFI wallet or show a balance. Send the student ID, or the student's full name and school.";
}

export function stillPending() {
  return 'A payment is still waiting for approval on the phone. Reply STATUS to check it. A new top-up cannot start until this one finishes.';
}
