import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { AuthService, type LoginRequest } from './auth.service';

@Controller('ai-quality-platform/auth')
export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  /**
   * @author codex
   * Logs in with the local administrator account.
   */
  @Post('login.do')
  async login(@Body() request: LoginRequest) {
    return ok(await this.authService.login(request));
  }
}
