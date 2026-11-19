import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, type ErrorCode, type ErrorResponse, nowUtcIso } from '@acs/shared';
import { isDbUnavailable } from './prisma-errors';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const CODE_TO_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 402,
  SERVICE_UNAVAILABLE: 503,
  PROVIDER_NOT_CONFIGURED: 503,
  PROVIDER_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/**
 * Bắt MỌI lỗi và trả về định dạng ErrorResponse thống nhất.
 * Lỗi 5xx không lộ stack/chi tiết nội bộ ra client, chỉ ghi log ở server.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.headers['x-request-id'];

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
    let details: unknown;

    if (exception instanceof AppError) {
      code = exception.code;
      status = CODE_TO_STATUS[code];
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message: unknown }).message)
            : exception.message;
      // Thông điệp tiếng Việt cho các lỗi thường gặp do framework/multer sinh ra
      if (status === 413) message = 'Dữ liệu hoặc file gửi lên vượt quá dung lượng cho phép';
      if (status === 404 && /^Cannot \w+ /.test(message)) message = 'Không tìm thấy đường dẫn API';
    } else if (isDbUnavailable(exception)) {
      status = 503;
      code = 'SERVICE_UNAVAILABLE';
      message = 'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.';
    }

    if (status >= 500) {
      const route = `${request.method} ${request.originalUrl} -> ${status}`;
      if (exception instanceof AppError) {
        // Lỗi đã được phân loại (vd. dịch vụ phụ thuộc down): 1 dòng là đủ
        this.logger.warn(`${route} [${code}] ${message}`);
      } else {
        this.logger.error(route, exception instanceof Error ? exception.stack : String(exception));
        details = undefined;
      }
    }

    const payload: ErrorResponse = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(typeof requestId === 'string' ? { requestId } : {}),
        timestamp: nowUtcIso(),
      },
    };
    response.status(status).json(payload);
  }
}
