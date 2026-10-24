import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new ConflictException('This email is already registered. Sign in instead.');
    }
    const role = dto.role === UserRole.CASHIER ? UserRole.CASHIER : UserRole.ADMIN;
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role,
      },
    });
    return this.issue(user);
  }

  private async issue(user: { id: string; email: string; name: string; role: UserRole }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Please sign in again.');
    }
    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a new password that is different from the current one.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
    });
    return { ok: true, message: 'Password updated.' };
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Please sign in again.');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Password is incorrect.');
    }
    const email = dto.email.trim().toLowerCase();
    if (email === user.email) {
      throw new BadRequestException('That is already your email.');
    }
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new ConflictException('This email is already in use.');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true, name: true, role: true },
    });
    return { ok: true, user: updated };
  }
}
