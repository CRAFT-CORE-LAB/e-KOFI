import { Body, Controller, Post, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';

@Controller('intouch')
export class IntouchCallbackController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('callback')
  @SkipThrottle()
  async callback(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const result = await this.payments.handleCallback(body ?? {});
    return res.status(200).json({
      message: 'success',
      success: true,
      request_id: result.request_id,
    });
  }
}
