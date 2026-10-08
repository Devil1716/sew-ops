import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { DowntimeController, IssuesController, OperatorIssuesController } from './issues.controller';
import { IssuesService } from './issues.service';

@Module({
  imports: [ProductionModule],
  controllers: [IssuesController, OperatorIssuesController, DowntimeController],
  providers: [IssuesService],
})
export class IssuesModule {}