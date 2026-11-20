import { extractStudentCode } from './intent';
import { amountInText, mentionsSchool, mentionsStudent, soundsLikeEkofi } from './match';

describe('Shaka WhatsApp message matching', () => {
  it('finds the school from its telling words', () => {
    expect(mentionsSchool('send money to keza at green hills', 'Green Hills Academy')).toBe(true);
    expect(mentionsSchool('send money to keza at hills', 'Green Hills Academy')).toBe(false);
    expect(mentionsSchool('Lycée de Kigali please', 'Lycee de Kigali')).toBe(true);
  });

  it('needs both the first and the last name', () => {
    expect(mentionsStudent('Keza Uwase, Green Hills', 'Keza', 'Uwase')).toBe(true);
    expect(mentionsStudent('for Keza please', 'Keza', 'Uwase')).toBe(false);
  });

  it('reads the amount out of a longer message, not the phone number', () => {
    expect(amountInText('Send 5,000 to Keza Uwase at Green Hills')).toBe(5000);
    expect(amountInText('10k for lunch')).toBe(10000);
    expect(amountInText('pay from 0788123456 please, 2000 rwf')).toBe(2000);
    expect(amountInText('Keza Uwase, Senior 2')).toBeNull();
    expect(amountInText('EKF-2026-001 3000')).toBe(3000);
  });

  it('does not read a description as a student ID', () => {
    expect(extractStudentCode('Keza Uwase S2 Green Hills')).toBeNull();
    expect(extractStudentCode('STU 000123')).toBe('STU000123');
    expect(extractStudentCode('my child is EKF-2026-001')).toBe('EKF-2026-001');
  });

  it('spots messages about e-KOFI', () => {
    expect(soundsLikeEkofi('I want to check my balance')).toBe(true);
    expect(soundsLikeEkofi('Ndashaka kohereza amafaranga')).toBe(true);
    expect(soundsLikeEkofi('Can you set up email for my company?')).toBe(false);
  });
});
