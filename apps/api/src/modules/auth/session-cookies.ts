import type { Response } from 'express';
import { AppConfig } from '../../config/configuration';

/** Sets the opaque session cookie. The token is never readable by JavaScript. */
export function setSessionCookie(response: Response, config: AppConfig, token: string): void {
  response.cookie(config.cookie.name, token, {
    httpOnly: true,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    path: '/',
    maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(response: Response, config: AppConfig): void {
  response.clearCookie(config.cookie.name, {
    httpOnly: true,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    path: '/',
  });
}

/**
 * Sets the CSRF cookie. It is intentionally readable by JavaScript: the browser has to copy it
 * into the `x-csrf-token` header.
 */
export function setCsrfCookie(response: Response, config: AppConfig, token: string): void {
  response.cookie(config.cookie.csrfName, token, {
    httpOnly: false,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    path: '/',
  });
}
