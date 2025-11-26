import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';

/**
 * Notifications Module
 * 
 * Handles all notification functionality including:
 * - Email notifications
 * - Email templates
 * - SMS notifications (future)
 * - Push notifications (future)
 * 
 * Dependencies:
 * - ConfigService: Configuration management
 * 
 * Exports:
 * - EmailService: For use in other modules
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
