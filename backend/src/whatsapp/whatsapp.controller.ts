import { Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { hubField, readInbound, type InboundMessage } from './inbound';
import { verifyWhatsAppSignature } from './signature';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
@SkipThrottle()
export class WhatsAppController {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get('webhook')
  verify(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const mode = hubField(query, 'mode');
    const token = hubField(query, 'verify_token');
    const challenge = hubField(query, 'challenge');
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN')?.trim();
    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).type('text/plain').send(challenge);
    }
    return res.status(403).json({ message: 'Webhook verification failed' });
  }

  @Post('webhook')
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Res() res: Response,
  ) {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET')?.trim() ?? '';
    const raw = req.rawBody;
    if (!raw || !verifyWhatsAppSignature(raw, signature, secret)) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      for (const message of readInbound(body)) {
        await this.whatsapp.handleInbound(message);
      }
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false });
    }
  }

  /**
   * Messages that reached Shaka's WhatsApp number. Shaka signs the body with the shared
   * SHAKA_BRIDGE_SECRET and asks whether the message is for e-KOFI. When it is, e-KOFI
   * runs the conversation and replies through Shaka (see WhatsAppCloudService).
   */
  @Post('bridge')
  async bridge(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shaka-signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    const secret = this.config.get<string>('SHAKA_BRIDGE_SECRET')?.trim() ?? '';
    const raw = req.rawBody;
    if (!raw || !verifyWhatsAppSignature(raw, signature, secret)) {
      return res.status(401).json({ message: 'Invalid bridge signature' });
    }
    const message = readBridgeMessage(req.body);
    if (!message) return res.status(400).json({ message: 'Expected { message: { id, from, kind, text } }' });
    const shakaLead = Boolean((req.body as { shakaLead?: unknown })?.shakaLead);
    try {
      const handled = await this.whatsapp.claims(message, shakaLead);
      if (handled) await this.whatsapp.handleInbound(message);
      return res.status(200).json({ handled });
    } catch {
      return res.status(500).json({ handled: false });
    }
  }
}

function readBridgeMessage(body: unknown): InboundMessage | null {
  const message = (body as { message?: Record<string, unknown> } | null)?.message;
  if (!message || typeof message !== 'object') return null;
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
  const id = text(message.id, 200);
  const from = text(message.from, 32);
  if (!id || !from) return null;
  const buttonId = text(message.buttonId, 256);
  return {
    id,
    from,
    kind: text(message.kind, 32) || 'text',
    text: text(message.text, 2000),
    ...(buttonId ? { buttonId } : {}),
  };
}
