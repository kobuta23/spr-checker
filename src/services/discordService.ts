import { Client, GatewayIntentBits, WebhookClient, EmbedBuilder } from 'discord.js';
import logger from '../utils/logger';
import config from '../config';

// Types for Referrer from referralService (avoid circular import)
interface Referral {
  address: string;
  SUPincome: string;
}

interface Referrer {
  address: string;
  username: string;
  SUPincome: string;
  rank: number;
  maxReferrals: number;
  unusedCodes: string[];
  referrals: Referral[];
}

// Bot configuration
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Initialize webhook client as a fallback method
let webhookClient: WebhookClient | null = null;
if (DISCORD_WEBHOOK_URL) {
  webhookClient = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
}

// Store leaderboard message ID for updates
let leaderboardMessageId: string | null = null;

// Define rank emojis
const RANK_EMOJIS = {
  1: '⭐', // Rank 1: Star
  2: '🥉', // Rank 2: Bronze
  3: '🥈', // Rank 3: Silver
  4: '🥇'  // Rank 4: Gold
};

// Connect to Discord
if (DISCORD_BOT_TOKEN) {
  client.login(DISCORD_BOT_TOKEN).catch(error => {
    logger.error('Failed to connect to Discord', { error });
  });

  client.once('ready', () => {
    logger.info(`Logged in to Discord as ${client.user?.tag}`);
  });
} else {
  logger.warn('Discord bot token not provided. Discord integration will be limited to webhook functionality.');
}

/**
 * Format SUP income to be more readable (in wei/s)
 */
const formatSUPIncome = (weiPerSecond: string): string => {
  if (weiPerSecond === '0') return '0';
  
  try {
    const bigWeiPerSecond = BigInt(weiPerSecond);
    
    // Format based on size
    if (bigWeiPerSecond >= BigInt('1000000000000000')) {
      // If > 0.001 SUP/s, show in SUP/s
      const supPerSecond = Number(bigWeiPerSecond) / 1e18;
      return `${supPerSecond.toFixed(6)} SUP/s`;
    } else {
      // Show in wei/s with abbreviations
      if (bigWeiPerSecond >= BigInt('1000000000000')) {
        const twei = Number(bigWeiPerSecond) / 1e12;
        return `${twei.toFixed(2)}T wei/s`;
      } else if (bigWeiPerSecond >= BigInt('1000000000')) {
        const gwei = Number(bigWeiPerSecond) / 1e9;
        return `${gwei.toFixed(2)}G wei/s`;
      } else if (bigWeiPerSecond >= BigInt('1000000')) {
        const mwei = Number(bigWeiPerSecond) / 1e6;
        return `${mwei.toFixed(2)}M wei/s`;
      } else {
        return `${bigWeiPerSecond.toString()} wei/s`;
      }
    }
  } catch (error) {
    logger.error('Error formatting SUP income', { error });
    return weiPerSecond;
  }
};

/**
 * Create a formatted embed for the leaderboard
 */
const createLeaderboardEmbed = (referrers: Referrer[]): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🏆 REFERRAL LEADERBOARD 🏆')
    .setDescription('Top referrers ranked by total SUP income from referred users')
    .setTimestamp()
    .setFooter({ text: 'Last updated' });

  // Limit to top 20 referrers for readability
  const topReferrers = referrers.slice(0, 20);
  
  // Create leaderboard fields
  let leaderboardText = '';
  
  topReferrers.forEach((referrer, index) => {
    // Calculate total SUP income from referrals
    const totalSUPincome = referrer.referrals.reduce(
      (sum, referral) => sum + BigInt(referral.SUPincome), 
      BigInt(0)
    );
    
    // Format the username to fixed width
    const username = referrer.username.length > 15 
      ? `${referrer.username.substring(0, 12)}...` 
      : referrer.username;
    
    // Format SUP income to be more readable
    const formattedSUP = formatSUPIncome(totalSUPincome.toString());
    
    // Get rank emoji
    const rankEmoji = RANK_EMOJIS[referrer.rank as keyof typeof RANK_EMOJIS] || '⭐';
    
    // Format referral count with max referrals
    const referralCount = `${referrer.referrals.length}/${referrer.maxReferrals}`;
    
    leaderboardText += `**${index + 1}.** ${rankEmoji} ${username} - ${referralCount} refs - ${formattedSUP}\n`;
    
    // Add fields in groups to avoid hitting embed limits
    if (index % 5 === 4 || index === topReferrers.length - 1) {
      embed.addFields({ 
        name: index === 4 ? 'Top 5 Referrers' : `Ranks ${index - (index % 5) + 1}-${index + 1}`,
        value: leaderboardText || 'No data',
        inline: false
      });
      leaderboardText = '';
    }
  });
  
  // Add legend for rank emojis
  embed.addFields({ 
    name: 'Rank System',
    value: `${RANK_EMOJIS[4]} Rank 4: 20 max referrals\n${RANK_EMOJIS[3]} Rank 3: 10 max referrals\n${RANK_EMOJIS[2]} Rank 2: 5 max referrals\n${RANK_EMOJIS[1]} Rank 1: 3 max referrals`,
    inline: false
  });
  
  return embed;
};

/**
 * Post leaderboard data to Discord
 */
const postLeaderboardToDiscord = async (referrers: Referrer[]): Promise<boolean> => {
  try {
    const embed = createLeaderboardEmbed(referrers);

    // Try to use the bot client first (preferred)
    if (client.isReady() && DISCORD_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel && channel.isTextBased() && 'send' in channel) {
          // Check if we already have a leaderboard message to update
          if (leaderboardMessageId) {
            try {
              const message = await channel.messages.fetch(leaderboardMessageId);
              await message.edit({ embeds: [embed] });
              logger.info('Successfully updated leaderboard in Discord');
              return true;
            } catch (error) {
              // If message not found or can't be edited, send a new one
              logger.warn('Could not update existing leaderboard message, sending new one');
              leaderboardMessageId = null;
            }
          }
          
          // Send new message
          const message = await channel.send({ embeds: [embed] });
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
    
    logger.warn('Discord integration not configured. Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID or DISCORD_WEBHOOK_URL.');
    return false;
  } catch (error: any) {
    logger.error('Failed to post leaderboard to Discord', { 
      error: error.message
    });
    return false;
  }
};

/**
 * Register a slash command to get the leaderboard
 * This should be called when the bot is ready
 */
const registerCommands = async (): Promise<void> => {
  if (!client.isReady()) {
    logger.warn('Cannot register commands, Discord client not ready');
    return;
  }
  
  try {
    // Register the /leaderboard command globally
    const commands = [
      {
        name: 'leaderboard',
        description: 'Show the referral leaderboard'
      }
    ];
    
    await client.application?.commands.set(commands);
    logger.info('Successfully registered Discord slash commands');
    
    // Set up interaction handler for the commands
    client.on('interactionCreate', async interaction => {
      if (!interaction.isCommand()) return;
      
      if (interaction.commandName === 'leaderboard') {
        try {
          // Defer reply to give us time to fetch data
          await interaction.deferReply();
          
          // Import here to avoid circular dependency
          const { getSortedReferrers } = await import('./referralService');
          
          // Get leaderboard data
          const referrers = await getSortedReferrers();
          const embed = createLeaderboardEmbed(referrers);
          
          // Reply with the embed
          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Error handling leaderboard command', { error });
          await interaction.editReply('Failed to fetch leaderboard data.');
        }
      }
    });
  } catch (error) {
    logger.error('Failed to register Discord commands', { error });
  }
};

// Register commands when the client is ready
if (DISCORD_BOT_TOKEN) {
  client.once('ready', () => {
    registerCommands();
  });
}

export {
  postLeaderboardToDiscord
}; 