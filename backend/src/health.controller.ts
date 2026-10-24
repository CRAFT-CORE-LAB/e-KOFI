import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle()
  health() {
    return { status: 'ok', service: 'e-kofi-api' };
  }
}
