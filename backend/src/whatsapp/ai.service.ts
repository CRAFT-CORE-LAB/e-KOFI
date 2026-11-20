import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveIntent, type Intent } from './intent';

@Injectable()
export class WhatsAppAiService {
  constructor(private readonly config: ConfigService) {}

  async interpret(state: string, text: string, buttonId?: string): Promise<Intent> {
    const local = resolveIntent({ state, text, buttonId });
    if (buttonId || local.type !== 'unknown') return local;
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) return local;
    try {
      const modelAction = await this.propose(apiKey, state, text);
      return resolveIntent({ state, text, modelAction });
    } catch {
      return local;
    }
  }

  private async propose(apiKey: string, state: string, text: string) {
    const model = this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Classify one parent message for an e-KOFI wallet top-up. Call propose_action once. Do not approve payments, invent amounts, or invent student IDs. Payment confirmation is not your action.',
            },
            { role: 'user', content: JSON.stringify({ state, text: text.slice(0, 500) }) },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'propose_action',
                parameters: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['greet', 'start', 'status', 'balance', 'no', 'unknown', 'student_id', 'amount'],
                    },
                  },
                  required: ['action'],
                },
              },
            },
          ],
          tool_choice: { type: 'function', function: { name: 'propose_action' } },
        }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
      };
      const raw = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { action?: unknown };
      return typeof parsed.action === 'string' ? parsed.action : null;
    } finally {
      clearTimeout(timer);
    }
  }
}
