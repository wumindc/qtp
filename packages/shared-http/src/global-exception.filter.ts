/**
 * @author codex
 * @author Antigravity/Gemini-3.1-Pro
 * 全局异常过滤器：拦截未处理异常，透传具体的业务错误信息到前端。
 */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    // 兼容底层依赖：此处使用 any 绕过对 express 类型的强依赖
    const response = ctx.getResponse<any>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || exception.message;
    } else if (exception instanceof Error) {
      // 核心改动：将标准的 Error 的 message 透传给前端
      // 大部分业务逻辑（如 execution.service.ts）直接抛出 Error
      message = exception.message;
      status = HttpStatus.BAD_REQUEST; // 业务错误更适合表现为 400 避免在云监控中产生过多致命告警
    } else if (typeof exception === 'string') {
      message = exception;
      status = HttpStatus.BAD_REQUEST;
    }

    response.status(status).json({
      code: status,
      success: false,
      message,
      data: null,
    });
  }
}
