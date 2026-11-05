import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ParentSessionDto } from './dto/parent-session.dto';
import { ParentTopUpDto } from './dto/parent-topup.dto';
import { ParentSession, ParentSessionGuard } from './parent-session.guard';
import { ParentsService } from './parents.service';

type ParentRequest = { parent: ParentSession };

@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Post('session')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  openSession(@Body() dto: ParentSessionDto) {
    return this.parents.openSession(dto.studentCode);
  }

  @Get('wallet')
  @UseGuards(ParentSessionGuard)
  @SkipThrottle()
  wallet(@Req() req: ParentRequest) {
    return this.parents.getWallet(req.parent.studentId);
  }

  @Post('top-up')
  @UseGuards(ParentSessionGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  topUp(@Req() req: ParentRequest, @Body() dto: ParentTopUpDto) {
    return this.parents.topUp(req.parent.studentId, dto.amountRwf, dto.mobilePhone, dto.idempotencyKey);
  }

  @Get('top-up/:requestId')
  @UseGuards(ParentSessionGuard)
  @SkipThrottle()
  topUpStatus(@Req() req: ParentRequest, @Param('requestId') requestId: string) {
    return this.parents.topUpStatus(req.parent.studentId, requestId);
  }
}
