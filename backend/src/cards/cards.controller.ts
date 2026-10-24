import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CardsService } from './cards.service';
import { BlockCardDto } from './dto/block-card.dto';
import { RegisterCardDto } from './dto/register-card.dto';
import { ResolveCardDto } from './dto/resolve-card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  list() {
    return this.cardsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cardsService.get(id);
  }

  @Post('register')
  @Roles(UserRole.ADMIN)
  register(@Body() dto: RegisterCardDto) {
    return this.cardsService.register(dto);
  }

  @Post('resolve')
  resolve(@Body() dto: ResolveCardDto) {
    return this.cardsService.resolve(dto);
  }

  @Post(':id/block')
  @Roles(UserRole.ADMIN)
  block(@Param('id') id: string, @Body() dto: BlockCardDto) {
    return this.cardsService.block(id, dto);
  }

  @Post(':id/replace')
  @Roles(UserRole.ADMIN)
  replace(@Param('id') id: string, @Body() dto: RegisterCardDto) {
    return this.cardsService.replace(id, dto);
  }
}
