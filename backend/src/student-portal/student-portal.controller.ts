import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { StudentCodeDto } from './dto/student-code.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { StudentRegisterDto } from './dto/student-register.dto';
import { StudentSession, StudentSessionGuard } from './student-session.guard';
import { StudentPortalService } from './student-portal.service';

type StudentRequest = { student: StudentSession };

@Controller('student-portal')
export class StudentPortalController {
  constructor(private readonly portal: StudentPortalService) {}

  @Post('lookup')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  lookup(@Body() dto: StudentCodeDto) {
    return this.portal.lookup(dto.studentCode);
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  register(@Body() dto: StudentRegisterDto) {
    return this.portal.register(dto.studentCode, dto.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  login(@Body() dto: StudentLoginDto) {
    return this.portal.login(dto.studentCode, dto.password);
  }

  @Get('wallet')
  @UseGuards(StudentSessionGuard)
  @SkipThrottle()
  wallet(@Req() req: StudentRequest) {
    return this.portal.getWallet(req.student.studentId);
  }
}
