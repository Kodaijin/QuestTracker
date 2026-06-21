// QuestTracker Discord bot entry point. Logs into the Discord gateway, registers
// its slash commands on startup, and dispatches interactions to the handlers in
// commands.ts. All quest data lives in the main app — this process only relays
// commands to the bot API and replies to the user (ephemerally).

import { Client, GatewayIntentBits, Events, REST, Routes, MessageFlags } from 'discord.js';
import { commands } from './commands.js';

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: instant per-guild registration

if (!token || !appId) {
  console.error('[bot] DISCORD_BOT_TOKEN and DISCORD_APP_ID are required. Exiting.');
  process.exit(1);
}
if (!process.env.BOT_API_SECRET) {
  console.warn('[bot] BOT_API_SECRET is not set — API calls will be rejected.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/**
 * Publish slash commands. Guild-scoped registration (DISCORD_GUILD_ID set) appears
 * instantly and is ideal for a single self-hosted server; global registration can
 * take up to an hour to propagate.
 */
async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token!);
  const body = commands.map((c) => c.data.toJSON());
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId!, guildId), { body });
    console.log(`[bot] Registered ${body.length} guild command(s) to ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(appId!), { body });
    console.log(`[bot] Registered ${body.length} global command(s).`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Logged in as ${c.user.tag}`);
  try {
    await registerCommands();
  } catch (e) {
    console.error('[bot] Failed to register commands:', e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((c) => c.data.toJSON().name === interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (e) {
    console.error(`[bot] Error handling /${interaction.commandName}:`, e);
    const msg = 'Something went wrong. Please try again.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(token);
