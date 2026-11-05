import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';

@Controller('intouch')
export class IntouchCallbackController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('callback')
  @HttpCode(200)
  @SkipThrottle()
  callback(@Body() body: Record<string, unknown>) {
    return this.payments.handleCallback(body ?? {});
  }
}
