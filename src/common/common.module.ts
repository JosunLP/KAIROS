import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { CacheService } from "./cache.service";
import { LoggerService } from "./logger.service";
import { MonitoringService } from "./monitoring.service";
import { NotificationService } from "./notification.service";
import { ValidationService } from "./validation.service";

@Module({
  imports: [ConfigModule],
  providers: [
    CacheService,
    LoggerService,
    MonitoringService,
    NotificationService,
    ValidationService,
  ],
  exports: [
    CacheService,
    LoggerService,
    MonitoringService,
    NotificationService,
    ValidationService,
  ],
})
export class CommonModule {}
