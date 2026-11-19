import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { SystemController } from './system.controller';

@Module({
  providers: [QueueService],
  controllers: [SystemController],
  exports: [QueueService],
})
export class QueueModule {}
