import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import dotenv from 'dotenv';
import logger from '../../utils/logger';
import { discordClient } from './index';

// Load environment variables
dotenv.config();

// Check for required environment variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = discordClient.user?.id || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || ''; // Only needed for guild commands

if (!TOKEN || !CLIENT_ID) {
  logger.error('Missing required environment variables: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID');
  process.exit(1);
}

// Configure REST instance
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function resetCommands() {
  try {
    logger.info('Started refreshing application commands...');

    // Transform commands into the format Discord expects
    const commandData = commands.map(command => command.data.toJSON());

    // First, delete all existing commands
    logger.info('Deleting all existing commands...');
    
    // If you're using guild commands
    if (GUILD_ID) {
      // Delete all guild commands
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: [] }
      );
      logger.info(`Successfully deleted all guild commands in guild ${GUILD_ID}`);
      
      // Then register the commands for the guild
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commandData }
      );
      logger.info(`Successfully reregistered ${commandData.length} guild commands in guild ${GUILD_ID}`);
    } else {
      // Delete all global commands
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );
      logger.info('Successfully deleted all global commands');
      
      // Then register global commands
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commandData }
      );
      logger.info(`Successfully reregistered ${commandData.length} global commands`);
    }

    // Log command names being registered
    logger.info('Registered commands: ' + commandData.map((cmd: any) => cmd.name).join(', '));

  } catch (error) {
    logger.error('Error refreshing commands:', error);
  }
}

// Execute the reset
resetCommands()
  .then(() => {
    logger.info('Command reset process completed.');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Fatal error during command reset:', error);
    process.exit(1);
  }); 