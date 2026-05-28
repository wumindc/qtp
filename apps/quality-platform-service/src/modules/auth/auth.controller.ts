import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '@ai-quality-platform/shared-http';
import { AuthService, type LoginRequest, type LoginUser } from './auth.service';

interface AuthControllerService {
  login(request: LoginRequest): Promise<LoginUser>;
  logout(): Promise<{ revoked: boolean }>;
}

@Controller('ai-quality-platform/auth')
export class AuthController {
  constructor(private readonly authService: AuthControllerService = new AuthService()) {}

  /**
   * @author codex
   * Logs in with a database-backed local account.
   */
  @Post('login.do')
  async login(@Body() request: LoginRequest) {
    return ok(await this.authService.login(request));
  }

  /**
   * @author codex
   * Completes stateless logout; browsers clear the stored token.
   */
  @Post('logout.do')
  async logout() {
    return ok(await this.authService.logout());
  }
}
