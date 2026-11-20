import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendResult = { ok: boolean; errorCode?: number | string };

@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.bridgeUrl || (this.token && this.phoneNumberId));
  }

  async deliver(
    to: string,
    text: string,
    buttons?: { id: string; title: string }[],
    template?: { name: string; params: string[] },
  ): Promise<SendResult> {
    if (this.bridgeUrl) return this.relay(to, text, buttons, template);
    const first = buttons?.length ? await this.sendButtons(to, text, buttons) : await this.sendText(to, text);
    if (first.ok || !template?.name) return first;
    if (first.errorCode !== 131047 && first.errorCode !== 131026) return first;
    return this.sendTemplate(to, template.name, template.params);
  }

  private async sendText(to: string, text: string): Promise<SendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.slice(0, 4096) },
    });
  }

  private async sendButtons(to: string, text: string, buttons: { id: string; title: string }[]): Promise<SendResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: text.slice(0, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map((button) => ({
            type: 'reply',
            reply: { id: button.id.slice(0, 256), title: button.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  private async sendTemplate(to: string, name: string, params: string[]): Promise<SendResult> {
    const language = this.config.get<string>('WHATSAPP_TEMPLATE_LANG')?.trim() || 'en';
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: params.map((value) => ({ type: 'text', text: value.slice(0, 200) })),
          },
        ],
      },
    });
  }

  private async post(payload: Record<string, unknown>): Promise<SendResult> {
    if (!this.configured()) return { ok: false, errorCode: 'not_configured' };
    const version = this.config.get<string>('WHATSAPP_GRAPH_VERSION')?.trim() || 'v21.0';
    try {
      const response = await fetch(`https://graph.facebook.com/${version}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
      if (!response.ok) {
        this.logger.warn(`WhatsApp send failed (${data.error?.code ?? response.status})`);
        return { ok: false, errorCode: data.error?.code ?? response.status };
      }
      return { ok: true };
    } catch {
      this.logger.warn('WhatsApp send could not reach Meta');
      return { ok: false, errorCode: 'network' };
    }
  }

  /**
   * Send through Shaka's WhatsApp number. Shaka sends the text (or buttons) and, when
   * Meta refuses free text because the 24-hour window closed, the template.
   */
  private async relay(
    to: string,
    text: string,
    buttons?: { id: string; title: string }[],
    template?: { name: string; params: string[] },
  ): Promise<SendResult> {
    const body = JSON.stringify({
      to,
      text: text.slice(0, 4096),
      ...(buttons?.length ? { buttons: buttons.slice(0, 3) } : {}),
      ...(template?.name
        ? {
            template: {
              name: template.name,
              lang: this.config.get<string>('WHATSAPP_TEMPLATE_LANG')?.trim() || 'en',
              params: template.params,
            },
          }
        : {}),
    });
    const signature = `sha256=${createHmac('sha256', this.bridgeSecret).update(body).digest('hex')}`;
    try {
      const response = await fetch(this.bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ekofi-Signature': signature },
        body,
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; errorCode?: number | string };
      if (!response.ok || !data.ok) {
        this.logger.warn(`Shaka WhatsApp relay failed (${String(data.errorCode ?? response.status)})`);
        return { ok: false, errorCode: data.errorCode ?? response.status };
      }
      return { ok: true };
    } catch {
      this.logger.warn('Shaka WhatsApp relay could not be reached');
      return { ok: false, errorCode: 'network' };
    }
  }

  private get bridgeUrl() {
    const url = this.config.get<string>('SHAKA_BRIDGE_URL')?.trim() ?? '';
    return url && this.bridgeSecret ? url : '';
  }

  private get bridgeSecret() {
    return this.config.get<string>('SHAKA_BRIDGE_SECRET')?.trim() ?? '';
  }

  private get token() {
    return this.config.get<string>('WHATSAPP_ACCESS_TOKEN')?.trim() ?? '';
  }

  private get phoneNumberId() {
    return this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim() ?? '';
  }
}
