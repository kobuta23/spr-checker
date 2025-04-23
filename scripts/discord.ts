import { Client, Events, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID_LEADERBOARD = process.env.DISCORD_CHANNEL_ID_LEADERBOARD;

// File to store the leaderboard message ID
const MESSAGE_ID_FILE = path.join(__dirname, 'leaderboard_message_id.txt');
const DISCORD_LEADERBOARD_MESSAGE_ID = process.env.DISCORD_LEADERBOARD_MESSAGE_ID;

// Function to save message ID to file
function saveMessageId(messageId: string): void {
  try {
    fs.writeFileSync(MESSAGE_ID_FILE, messageId);
    console.log(`Message ID ${messageId} saved to file`);
  } catch (error) {
    console.error('Error saving message ID:', error);
  }
}

async function updateLeaderboardMessage() {
  // Validate required environment variables
  if (!DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
  }

  if (!DISCORD_LEADERBOARD_MESSAGE_ID) {
    console.error('Error: DISCORD_LEADERBOARD_MESSAGE_ID is not set in environment variables');
    process.exit(1);
  }

  // Create new Discord client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    // Wait for client to be ready using a promise
    await new Promise<void>((resolve, reject) => {
      client.once(Events.ClientReady, () => {
        console.log(`Discord bot is ready! Logged in as ${client.user?.tag}`);
        resolve();
      });
      
      client.once(Events.Error, (error) => {
        reject(error);
      });
      
      // Login
      client.login(DISCORD_TOKEN).catch(reject);
    });

    // Get the channel
    console.log('Fetching channel...');
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID_LEADERBOARD);
    
    if (!channel) {
      throw new Error(`Channel with ID ${DISCORD_CHANNEL_ID_LEADERBOARD} not found`);
    }
    
    if (!channel.isTextBased() || !('messages' in channel)) {
      throw new Error('Channel is not a text channel or does not support messages');
    }

    const textChannel = channel as TextChannel;
    const currentDate = new Date().toISOString();
    
    // Create a leaderboard embed
    const leaderboardEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🏆 REFERRAL LEADERBOARD 🏆')
      .setDescription('Top referrers ranked by SUP income')
      .addFields(
        { name: 'Last Update', value: currentDate },
        { name: 'Top Referrers', value: 'Data will appear here in production' }
      )
      .setFooter({ text: 'Updated at' })
      .setTimestamp();

    // Try to get existing message ID
    const savedMessageId = DISCORD_LEADERBOARD_MESSAGE_ID;
    let message;
    
    if (savedMessageId) {
      console.log(`Trying to fetch message with ID: ${savedMessageId}`);
      try {
        message = await textChannel.messages.fetch(savedMessageId);
        console.log('Found existing leaderboard message, updating it...');
      } catch (error) {
        console.log('Could not find the saved message, will create a new one');
        message = null;
      }
    }

    if (message) {
      // Edit existing message
      try {
        await message.edit({embeds: [leaderboardEmbed] });
        console.log('Leaderboard message updated successfully');
      } catch (error) {
        console.error('Error updating leaderboard message:', error);
      }
    } else {
      // Send new message
      console.log('Sending new leaderboard message...');
      const newMessage = await textChannel.send({embeds: [leaderboardEmbed] });
      console.log('New leaderboard message sent successfully');
      
      // Save the new message ID
      saveMessageId(newMessage.id);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the client connection
    console.log('Destroying client...');
    client.destroy();
    console.log('Done!');
  }
}

// IIFE to allow async/await at the top level
(async () => {
  console.log('Starting Discord leaderboard update...');
  await updateLeaderboardMessage();
  process.exit(0); // Ensure script exits even if there are lingering promises
})().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
