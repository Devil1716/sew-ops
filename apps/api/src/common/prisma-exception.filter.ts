import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message = 'Internal server error';

    switch (exception.code) {
      case 'P2002':
        status = 409;
        message = 'A record with the same unique value already exists.';
        break;
      case 'P2025':
        status = 404;
        message = 'Record not found.';
        break;
      case 'P2003':
        status = 409;
        message = 'This record is linked to other data and cannot be changed that way.';
        break;
      default:
        this.logger.error(`${exception.code}: ${exception.message}`);
    }

    res.status(status).json({ statusCode: status, message });
  }
}