import { Module } from '@nestjs/common';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { NavigationRepository } from './navigation.repository';
import { JwtService } from '../../common/services/jwt.service';

@Module({
  controllers: [NavigationController],
  providers: [NavigationService, NavigationRepository, JwtService],
  exports: [NavigationService],
})
export class NavigationModule {}
