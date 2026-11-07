import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface HttpRequest {
  originalUrl: string;
  traceId?: string;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const traceId = request.traceId ?? randomUUID();
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const data = payload && typeof payload === 'object'
      ? payload as { errorCode?: unknown; message?: unknown }
      : undefined;

    const fallbackCodes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      429: 'TOO_MANY_REQUESTS',
    };
    let errorCode = typeof data?.errorCode === 'string'
      ? data.errorCode
      : fallbackCodes[status] ?? 'HTTP_ERROR';
    let message = typeof payload === 'string' ? payload
      : typeof data?.message === 'string' ? data.message
      : Array.isArray(data?.message) ? data.message.filter((item) => typeof item === 'string').join('; ')
      : 'Request failed';

    if (status >= 500) {
      errorCode = 'INTERNAL_SERVER_ERROR';
      message = 'Internal server error';
      this.logger.error(`[${traceId}] ${exception instanceof Error ? exception.stack : 'Unexpected error'}`);
    }

    response.setHeader('X-Trace-Id', traceId);
    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      traceId,
    });
  }
}
