import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { UserService } from './user.service.js';
import { CurrentUser } from '../common/decorator/current-user.decorator.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, dto);
  }
}
