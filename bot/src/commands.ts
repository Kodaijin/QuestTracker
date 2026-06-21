// Slash-command definitions and handlers. Each command turns a Discord
// interaction into an authenticated HTTP call to the QuestTracker bot API
// (src/app/api/bot/quests), passing the invoking user's Discord id so the server
// can map it to the linked account.

import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

const APP_URL = (process.env.APP_URL ?? 'http://app:3000').replace(/\/$/, '');
const BOT_API_SECRET = process.env.BOT_API_SECRET ?? '';

// Mirrors the app's Difficulty enum (prisma/schema.prisma).
const DIFFICULTIES = ['TRIVIAL', 'EASY', 'NORMAL', 'HARD', 'LEGENDARY'] as const;

/** Split a comma-separated option into a trimmed, non-empty list. */
function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Authenticated request to the bot API; returns parsed JSON + ok flag. */
async function callApi(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOT_API_SECRET}`,
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export interface Command {
  data: { toJSON(): RESTPostAPIApplicationCommandsJSONBody };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const addQuest: Command = {
  data: new SlashCommandBuilder()
    .setName('addquest')
    .setDescription('Create a new quest in QuestTracker')
    .addStringOption((o) => o.setName('title').setDescription('Quest title').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('objectives')
        .setDescription('Comma-separated objectives, e.g. "Read chapter, Take notes"')
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('Optional quest description').setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName('difficulty')
        .setDescription('Quest difficulty (default: Normal)')
        .setRequired(false)
        .addChoices(
          ...DIFFICULTIES.map((d) => ({ name: d.charAt(0) + d.slice(1).toLowerCase(), value: d })),
        ),
    )
    .addStringOption((o) =>
      o
        .setName('items')
        .setDescription('Optional comma-separated inventory items to gather')
        .setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const quest: Record<string, unknown> = {
      title: interaction.options.getString('title', true),
      objectives: splitList(interaction.options.getString('objectives', true)),
    };
    const description = interaction.options.getString('description');
    const difficulty = interaction.options.getString('difficulty');
    const items = splitList(interaction.options.getString('items'));
    if (description) quest.description = description;
    if (difficulty) quest.difficulty = difficulty;
    if (items.length > 0) quest.inventoryItems = items;

    const { ok, data } = await callApi('/api/bot/quests', {
      method: 'POST',
      body: JSON.stringify({ discordUserId: interaction.user.id, quest }),
    });

    if (ok) {
      await interaction.editReply(`✅ Quest created: **${data.title ?? quest.title}**`);
    } else {
      await interaction.editReply(`⚠️ ${data.error ?? 'Could not create the quest.'}`);
    }
  },
};

const listQuests: Command = {
  data: new SlashCommandBuilder()
    .setName('quests')
    .setDescription('List your open quests'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { ok, data } = await callApi(
      `/api/bot/quests?discordUserId=${encodeURIComponent(interaction.user.id)}`,
    );

    if (!ok) {
      await interaction.editReply(`⚠️ ${data.error ?? 'Could not fetch your quests.'}`);
      return;
    }

    const quests = (data.quests as { title: string }[]) ?? [];
    if (quests.length === 0) {
      await interaction.editReply('🎉 You have no open quests!');
      return;
    }
    const list = quests.map((q) => `• ${q.title}`).join('\n');
    await interaction.editReply(`🗒️ Your open quests:\n${list}`);
  },
};

export const commands: Command[] = [addQuest, listQuests];
