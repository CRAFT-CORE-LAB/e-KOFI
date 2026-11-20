import { amountInRange, parseAmountRwf } from './amount';
import { looksLikeRwandaPhone, rwandaMobileOrNull } from './phone';
import { WaState } from './states';

export type Intent =
  | { type: 'greet' }
  | { type: 'start' }
  | { type: 'cancel' }
  | { type: 'status' }
  | { type: 'balance' }
  | { type: 'yes' }
  | { type: 'no' }
  | { type: 'confirm_payment' }
  | { type: 'unknown' }
  | { type: 'student_id'; studentCode: string }
  | { type: 'amount'; amountRwf: number }
  | { type: 'link_code'; code: string }
  | { type: 'pay_phone'; phone: string };

const START = /\b(top[\s-]?up|deposit|add money|fund|wallet|lunch money|send money|pay for)\b/i;
const CANCEL = /\b(cancel|stop|never mind|nevermind|abort)\b/i;
const STATUS = /\b(status|complete|completed|gone through|processed|pending|did it|is my payment)\b/i;
const BALANCE = /\b(balance|how much (is|does)|wallet balance)\b/i;
const NO = /\b(no|nope|wrong|not my|try again|different student|incorrect)\b/i;
const YES = /^(yes|yeah|yep|confirm|ok|okay|correct|that's my|that is my)\b/i;
const CONFIRM_PAY = /\b(confirm payment|proceed|yes,? pay|pay now|go ahead)\b/i;

export function extractStudentCode(text: string) {
  const trimmed = text.trim();
  const labeled = trimmed.match(/\b([A-Za-z]{1,8}[-/][A-Za-z0-9-]{2,24})\b/);
  if (labeled) return labeled[1].replace(/\s+/g, '').replace(/\//g, '-').toUpperCase();
  const compact = trimmed.replace(/\s+/g, '');
  if (/^[A-Za-z0-9-]{2,32}$/.test(compact) && /[A-Za-z]/.test(compact) && /\d/.test(compact)) {
    return compact.toUpperCase();
  }
  if (/^\d{2,12}$/.test(compact)) return compact;
  return null;
}

export function extractLinkCode(text: string) {
  const match = text.trim().match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function localIntent(state: string, text: string, buttonId?: string): Intent {
  if (buttonId === 'confirm_student') return { type: 'yes' };
  if (buttonId === 'reject_student') return { type: 'no' };
  if (buttonId === 'confirm_payment') return { type: 'confirm_payment' };
  if (buttonId === 'cancel_payment') return { type: 'cancel' };

  const trimmed = text.trim();
  if (!trimmed) return { type: 'unknown' };
  if (CANCEL.test(trimmed)) return { type: 'cancel' };
  if (CONFIRM_PAY.test(trimmed) && state === WaState.AWAITING_PAYMENT_CONFIRMATION) {
    return { type: 'confirm_payment' };
  }
  if (state === WaState.VERIFYING_PARENT) {
    const code = extractLinkCode(trimmed);
    if (code && trimmed.replace(/\D/g, '').length === 6) return { type: 'link_code', code };
  }
  if (looksLikeRwandaPhone(trimmed)) {
    const phone = rwandaMobileOrNull(trimmed);
    if (phone) return { type: 'pay_phone', phone };
  }
  if (
    (state === WaState.REQUESTING_AMOUNT || state === WaState.AWAITING_PAYMENT_CONFIRMATION) &&
    parseAmountRwf(trimmed).ok
  ) {
    const parsed = parseAmountRwf(trimmed);
    if (parsed.ok) return { type: 'amount', amountRwf: parsed.value };
  }
  if (state === WaState.AWAITING_STUDENT_CONFIRMATION && YES.test(trimmed)) return { type: 'yes' };
  if (state === WaState.AWAITING_PAYMENT_CONFIRMATION && YES.test(trimmed)) return { type: 'confirm_payment' };
  if (NO.test(trimmed) && (state === WaState.AWAITING_STUDENT_CONFIRMATION || state === WaState.VERIFYING_PARENT)) {
    return { type: 'no' };
  }
  if (STATUS.test(trimmed)) return { type: 'status' };
  if (BALANCE.test(trimmed)) return { type: 'balance' };
  if (
    state === WaState.INITIAL ||
    state === WaState.REQUESTING_STUDENT_ID ||
    state === WaState.VERIFYING_PARENT ||
    state === WaState.AWAITING_STUDENT_CONFIRMATION ||
    state === WaState.CANCELLED ||
    state === WaState.EXPIRED ||
    state === WaState.PAYMENT_SUCCESSFUL ||
    state === WaState.PAYMENT_FAILED
  ) {
    const code = extractStudentCode(trimmed);
    if (
      code &&
      (state === WaState.REQUESTING_STUDENT_ID ||
        state === WaState.VERIFYING_PARENT ||
        !START.test(trimmed.replace(code, ' ')))
    ) {
      return { type: 'student_id', studentCode: code };
    }
  }
  if (GREET(trimmed) && !START.test(trimmed)) return { type: 'greet' };
  if (START.test(trimmed) || /^(hi|hello|hey)\b/i.test(trimmed)) return { type: 'start' };
  return { type: 'unknown' };
}

function GREET(text: string) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(text.trim());
}

const MODEL_ACTIONS = new Set(['greet', 'start', 'status', 'balance', 'no', 'unknown']);

export function resolveIntent(input: {
  state: string;
  text: string;
  buttonId?: string;
  modelAction?: string | null;
}): Intent {
  const local = localIntent(input.state, input.text, input.buttonId);
  if (input.buttonId) return local;
  if (
    local.type === 'cancel' ||
    local.type === 'confirm_payment' ||
    local.type === 'yes' ||
    local.type === 'no' ||
    local.type === 'amount' ||
    local.type === 'link_code' ||
    local.type === 'pay_phone' ||
    local.type === 'student_id'
  ) {
    return local;
  }
  if (input.modelAction === 'student_id') {
    const code = extractStudentCode(input.text);
    if (code) return { type: 'student_id', studentCode: code };
  }
  if (input.modelAction === 'amount') {
    const parsed = parseAmountRwf(input.text);
    if (parsed.ok && amountInRange(parsed.value)) return { type: 'amount', amountRwf: parsed.value };
  }
  if (input.modelAction && MODEL_ACTIONS.has(input.modelAction)) {
    return { type: input.modelAction as 'greet' | 'start' | 'status' | 'balance' | 'no' | 'unknown' };
  }
  return local;
}
