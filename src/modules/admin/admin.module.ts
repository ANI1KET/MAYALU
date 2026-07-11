import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { SmsService } from '../../common/services/sms.service';
import { MediaService } from '../../common/services/media.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, SmsService, MediaService],
})
export class AdminModule {}
