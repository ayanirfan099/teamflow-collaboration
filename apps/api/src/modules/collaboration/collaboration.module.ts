import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivityService } from './activity.service';
import { CollaborationController } from './collaboration.controller';
import { CommentsService } from './comments.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [RealtimeModule],
  controllers: [CollaborationController],
  providers: [ActivityService, CommentsService, NotificationsService],
  exports: [ActivityService, CommentsService, NotificationsService],
})
export class CollaborationModule {}
