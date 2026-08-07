/**
 * Server-side admin authorization.
 *
 * Uses `reddit.getCurrentUsername()` (Devvit-authenticated identity)
 * to verify the caller is a developer. This cannot be spoofed from
 * the client — it comes from Reddit's own auth layer.
 */

import { reddit } from '@devvit/web/server';
import type { Context, Next } from 'hono';

/** Hardcoded developer accounts — the only users who can access admin/debug endpoints. */
const DEV_USERS = ['WeirdAd4511'];

/**
 * Hono middleware: rejects the request with 403 if the authenticated
 * Reddit user is not in the DEV_USERS list.
 */
export async function requireDev(c: Context, next: Next): Promise<Response> {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username || !DEV_USERS.some(u => u.toLowerCase() === username.toLowerCase())) {
      return c.json({ error: 'Unauthorized — dev access required' }, 403);
    }
  } catch {
    return c.json({ error: 'Unauthorized — unable to verify identity' }, 403);
  }
  return next() as unknown as Response;
}

/**
 * Check if a username is a dev (for non-middleware use cases).
 */
export function isDev(username: string): boolean {
  return DEV_USERS.some(u => u.toLowerCase() === username.toLowerCase());
}
