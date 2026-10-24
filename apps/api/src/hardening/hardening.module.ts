import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { runEnvironmentCheck } from './env-check';
import { RequestContextMiddleware } from './request-context.middleware';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

@Module({
  providers: [{ provide: 'ENVIRONMENT_CHECK', useFactory: () => runEnvironmentCheck() }],
})
export class HardeningModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, SecurityHeadersMiddleware).forRoutes('*');
  }
}