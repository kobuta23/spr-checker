import { Client, GatewayIntentBits, WebhookClient, EmbedBuilder, TextChannel, CommandInteraction, MessageFlags } from 'discord.js';
import logger from '../../utils/logger';
import { formatSUPIncome } from '../../utils/formatter';
import { getSortedReferrers, getReferrerByDiscordId, getAvailableCodes } from '../../services/referralService';
import { Referrer } from '../../services/referralService';
import { commands } from './commands';
import { createLeaderboardEmbed } from './utils';
// Types for Referral (avoid circular import)
interface Referral {
  address: string;
  SUPincome: string;
}

// Private state
export let discordClient: Client;
let webhookClient: WebhookClient | null = null;
let leaderboardMessageId: string | null = process.env.DISCORD_LEADERBOARD_MESSAGE_ID || null;
let isInitialized: boolean = false;

// Config values
const botToken = process.env.DISCORD_TOKEN || '';
const channelId = process.env.DISCORD_CHANNEL_ID_LEADERBOARD || '';
const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';


/**
 * Initialize the Discord service and connect to Discord
 */
const initialize = async (): Promise<boolean> => {
  if (isInitialized) return true;
  
  if (!botToken) {
    logger.warn('Discord bot token not provided. Discord integration will be limited to webhook functionality.');
    isInitialized = true;
    return false;
  }
  
  try {
    // Create client with needed intents if not already created
    if (!discordClient) {
      discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });
      
      // Set up event handlers
      discordClient.once('ready', () => {
        logger.info(`Logged in to Discord as ${discordClient.user?.tag}`);
        registerCommands();
      });
    }
    
    // Initialize webhook if URL provided and not already initialized
    if (webhookUrl && !webhookClient) {
      webhookClient = new WebhookClient({ url: webhookUrl });
    }
    
    await discordClient.login(botToken);
    isInitialized = true;
    return true;
  } catch (error) {
    logger.error('Failed to connect to Discord', { error });
    return false;
  }
};

/**
 * Shut down the Discord service
 */
const shutdown = async (): Promise<void> => {
  if (discordClient?.isReady()) {
    await discordClient.destroy();
    logger.info('Discord client disconnected');
  }
  isInitialized = false;
};

/**
 * Post leaderboard data to Discord
 */
export const postLeaderboard = async (referrers: Referrer[]): Promise<boolean> => {
  if (!isInitialized) {
    await initialize();
  }
  console.log("posting leaderboard to discord. Initialized: ", isInitialized);

  try {
    const embed = createLeaderboardEmbed(referrers);
    console.log("discordClient: ", discordClient?.isReady());

    // Try to use the bot client first (preferred)
    if (discordClient?.isReady() && channelId) {
      try {
        const channel = await discordClient.channels.fetch(channelId);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const textChannel = channel as TextChannel;
          
          // Check if we already have a leaderboard message to update
          if (leaderboardMessageId) {
            try {
              const message = await textChannel.messages.fetch(leaderboardMessageId);
              await message.edit({content: " ", embeds: [embed] });
              logger.info('Successfully updated leaderboard in Discord');
              return true;
            } catch (error) {
              // If message not found or can't be edited, send a new one
              logger.warn('Could not update existing leaderboard message, sending new one');
              leaderboardMessageId = null;
            }
          }
          
          // Send new message
          const message = await textChannel.send({ embeds: [embed] });
          leaderboardMessageId = message.id;
          logger.info('Successfully posted leaderboard to Discord');
          return true;
        } else {
          logger.warn('Retrieved channel is not a text channel or does not support sending messages');
        }
      } catch (error) {
        logger.error('Error sending leaderboard through bot client', { error });
        // Fall through to webhook method
      }
    }
    
    // Fallback to webhook method
    if (webhookClient) {
      await webhookClient.send({
        embeds: [embed]
      });
      logger.info('Successfully posted leaderboard to Discord via webhook');
      return true;
    }
    
    logger.warn('Discord integration not configured. Set DISCORD_TOKEN and DISCORD_CHANNEL_ID or DISCORD_WEBHOOK_URL.');
    return false;
  } catch (error: any) {
    logger.error('Failed to post leaderboard to Discord', { 
      error: error.message
    });
    return false;
  }
};


/**
 * Register slash commands with Discord
 */
const registerCommands = async (): Promise<void> => {
  if (!discordClient?.isReady()) {
    logger.warn('Cannot register commands, Discord client not ready');
    return;
  }
  
  try {
    const commandList = commands.map(command => command.data);
    const registeredCommands = 
      await discordClient.application?.commands.set(commandList);
    console.info("registeredCommands: ", registeredCommands?.map(command => command.name));

    logger.info('Successfully registered Discord slash commands');
    logger.discordNotify('Successfully registered Discord slash commands');
    logger.discordNotify(registeredCommands?.map(command => command.name).join(', '));
    // Set up interaction handler for the commands
    discordClient.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;
      const command = commands.find(command => command.data.name === interaction.commandName);
      if (command) {
        await command.function(interaction);
      }
    });
  } catch (error) {
    logger.error('Failed to register Discord commands', { error });
  }
};

// Initialize at service startup
if (botToken || webhookUrl) {
  initialize().catch(error => {
    logger.error('Failed to initialize Discord service', { error });
  });
}

// Export methods
export default {
  initialize,
  shutdown,
  postLeaderboard
}; 