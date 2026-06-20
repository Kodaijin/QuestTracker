// Server-only Discord helper. Posts plain messages to a single shared channel
// via an admin-configured incoming webhook (DISCORD_WEBHOOK_URL). The channel is
// disabled whenever the URL is unset, mirroring pushConfigured() in src/lib/push.ts.
// Imported only by server actions / the reminder sweep — never the client.
//
// A Discord webhook can only post to one channel and cannot DM, so every message
// lands in the same place and mentions the relevant user(s) inline.

/** Discord rejects message content longer than 2000 characters. */
const MAX_CONTENT = 2000;

/** Returns true if a webhook URL is configured and messages can be sent. */
export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

/**
 * Render a user's stored Discord handle as message content. An all-digit value is
 * a numeric User ID → a real `<@id>` ping that notifies the user. Anything else is
 * shown as plain `@name` text (Discord webhooks don't resolve @username to a ping).
 * Returns '' for a missing handle so callers can drop the mention cleanly.
 */
export function discordMention(value: string | null | undefined): string {
  const v = value?.trim();
  if (!v) return '';
  return /^\d{5,}$/.test(v) ? `<@${v}>` : `@${v}`;
}

/** Build an absolute link to a page in the app, e.g. questLink('/projects/abc'). */
export function appLink(path: string): string {
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Post a message to the shared Discord channel. No-ops when unconfigured, and
 * never throws — webhook failures must not break a sweep or a quest action.
 * Numeric `<@id>` mentions in `content` ping by default, so no allowed_mentions
 * config is needed.
 */
export async function sendDiscordMessage(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const trimmed = content.length > MAX_CONTENT ? `${content.slice(0, MAX_CONTENT - 1)}…` : content;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    });
  } catch {
    // Swallow: a Discord outage or bad webhook URL must not surface to the user.
  }
}
