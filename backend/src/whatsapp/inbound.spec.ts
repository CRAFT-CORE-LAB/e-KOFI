import { readInbound } from './inbound';

describe('WhatsApp inbound payloads', () => {
  it('reads text and reply buttons', () => {
    const messages = readInbound({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: '250788123456', id: 'wamid.1', type: 'text', text: { body: 'EKF-2026-001' } },
                  {
                    from: '250788123456',
                    id: 'wamid.2',
                    type: 'interactive',
                    interactive: { button_reply: { id: 'confirm_student', title: 'Yes, confirm' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages).toEqual([
      { from: '250788123456', id: 'wamid.1', text: 'EKF-2026-001', kind: 'text' },
      { from: '250788123456', id: 'wamid.2', text: 'Yes, confirm', buttonId: 'confirm_student', kind: 'button' },
    ]);
  });
});
