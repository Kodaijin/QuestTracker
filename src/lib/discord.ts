// Server-only Discord helper. Posts plain messages to a single shared channel
// via an admin-configured incoming webhook (DISCORD_WEBHOOK_URL). The channel is
// disabled whenever the URL is unset, mirroring pushConfigured() in src/lib/push.ts.
// Imported only by server actions / the reminder sweep — never the client.
//
// A Discord webhook can only post to one channel and cannot DM, so every message
// lands in the same place and mentions the relevant user(s) inline.

/** Discord rejects message content longer than 2000 characters. */
const MAX_CONTENT = 2000;

// Discord embed field limits (https://discord.com/developers/docs/resources/channel#embed-limits).
const MAX_EMBED_DESCRIPTION = 4096;
const MAX_EMBED_FIELD_VALUE = 1024;
const MAX_EMBED_FIELD_NAME = 256;
const MAX_EMBED_TITLE = 256;
const MAX_EMBED_FIELDS = 25;

/**
 * Palette of decimal RGB colors used for the left-hand accent bar of embeds, so
 * each kind of post is visually distinguishable at a glance in the channel.
 */
export const EmbedColors = {
  QUEST_START: 0x5865f2, // blurple — a new group quest begins
  INVITE: 0x9b59b6, // purple — you've been invited
  PROGRESS: 0x3498db, // blue — party progress made
  COMPLETE: 0xf1c40f, // gold — quest complete 🏆
  REMINDER: 0x2ecc71, // green — daily/open-quest nudge
  DEADLINE: 0xe67e22, // orange — due soon
  STREAK: 0xe74c3c, // red — streak at risk
  PET: 0xe91e63, // pink — companion mood
  ACTIVATION: 0x1abc9c, // teal — a quest just became available
} as const;

/** A minimal Discord embed. Mentions inside an embed never ping — put pings in `content`. */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number; // decimal RGB
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string; // ISO 8601
}

/** Truncate a string to `max` characters, appending an ellipsis when clipped. */
function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Apply Discord's per-field length limits so a payload is never rejected. */
function sanitizeEmbed(embed: DiscordEmbed): DiscordEmbed {
  const out: DiscordEmbed = { ...embed };
  if (out.title) out.title = clamp(out.title, MAX_EMBED_TITLE);
  if (out.description) out.description = clamp(out.description, MAX_EMBED_DESCRIPTION);
  if (out.fields) {
    out.fields = out.fields.slice(0, MAX_EMBED_FIELDS).map((f) => ({
      name: clamp(f.name, MAX_EMBED_FIELD_NAME),
      value: clamp(f.value, MAX_EMBED_FIELD_VALUE),
      inline: f.inline,
    }));
  }
  return out;
}

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

/**
 * Post a rich embed to the shared Discord channel. `content` carries any pings —
 * Discord does NOT resolve mentions placed inside an embed, only in the top-level
 * message content. No-ops when unconfigured and never throws, mirroring
 * sendDiscordMessage().
 */
export async function sendDiscordEmbed(embed: DiscordEmbed, content?: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const body: { embeds: DiscordEmbed[]; content?: string } = {
    embeds: [sanitizeEmbed(embed)],
  };
  if (content) body.content = clamp(content, MAX_CONTENT);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Swallow: a Discord outage or bad webhook URL must not surface to the user.
  }
}
