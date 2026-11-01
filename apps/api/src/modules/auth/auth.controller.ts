import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { loginRequestSchema, registerRequestSchema } from '@teamflow/contracts';
import type { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { CurrentUser, Public, RateLimit } from '../../common/decorators';
import { AppException } from '../../common/errors';
import { parse } from '../../common/validation/parse';
import { AuthenticatedUser } from '../../common/types';
import { AuthService } from './auth.service';
import { clearSessionCookie, setCsrfCookie, setSessionCookie } from './session-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * A CSRF token.
   *
   * Without a session the token is anonymous (sign-in, registration). With a session the token
   * is bound to the session id, so a token of another session is rejected. The token is also
   * set as a readable cookie, so the browser can echo it in the `x-csrf-token` header.
   */
  @Get('csrf')
  @Public()
  csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionId = request.context?.session?.id;
    const token = sessionId
      ? this.auth.sessionCsrfToken(sessionId)
      : this.auth.anonymousCsrfToken();
    setCsrfCookie(response, this.config, token);
    return { data: { token } };
  }

  @Post('register')
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 60 * 60, scope: 'ip-and-email' })
  async register(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parse(registerRequestSchema, body);
    const result = await this.auth.register(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    setSessionCookie(response, this.config, result.tokens.token);
    setCsrfCookie(response, this.config, result.tokens.csrfToken);

    const me = await this.auth.me(result.userId);
    return { data: me };
  }

  @Post('login')
  @Public()
  @RateLimit({ limit: 10, windowSeconds: 60 * 60, scope: 'ip-and-email' })
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parse(loginRequestSchema, body);
    const result = await this.auth.login(input, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    setSessionCookie(response, this.config, result.tokens.token);
    setCsrfCookie(response, this.config, result.tokens.csrfToken);

    const me = await this.auth.me(result.userId);
    return { data: me };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionId = request.context?.session?.id;
    if (sessionId) {
      await this.auth.logout(sessionId);
    }
    clearSessionCookie(response, this.config);
    return { data: { signedOut: true } };
  }

  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const count = await this.auth.logoutAll(user.id);
    clearSessionCookie(response, this.config);
    return { data: { revokedSessions: count } };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    const me = await this.auth.me(user.id);
    const sessionId = request.context?.session?.id;
    const activeSession = sessionId
      ? await this.auth
          .sessions(user.id)
          .then((sessions) => sessions.find((session) => session.id === sessionId))
      : undefined;
    return { data: { ...me, ...(activeSession ? { activeSession } : {}) } };
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.auth.sessions(user.id);
    return { data: sessions };
  }

  /** Returns the CSRF token that belongs to the current session. */
  @Get('csrf-token')
  csrfToken(@Req() request: Request) {
    const sessionId = request.context?.session?.id;
    if (!sessionId) {
      throw AppException.unauthenticated();
    }
    return { data: { token: this.auth.sessionCsrfToken(sessionId) } };
  }
}
