import { Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { hubField, readInbound } from './inbound';
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
}
