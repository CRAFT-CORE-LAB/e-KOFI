import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type ParentSession = { studentId: string; studentCode: string };

@Injectable()
export class ParentSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; parent?: ParentSession }>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Enter your child’s Student ID again.');
    }
    try {
      const payload = this.jwt.verify<{ sub?: string; code?: string; typ?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.typ !== 'parent' || !payload.sub || !payload.code) {
        throw new UnauthorizedException('This session expired. Enter the Student ID again.');
      }
      request.parent = { studentId: payload.sub, studentCode: payload.code };
      return true;
    } catch {
      throw new UnauthorizedException('This session expired. Enter the Student ID again.');
    }
  }
}
