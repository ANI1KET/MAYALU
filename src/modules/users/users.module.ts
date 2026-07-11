import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, JwtService],
  exports: [UsersService],
})
export class UsersModule {}
