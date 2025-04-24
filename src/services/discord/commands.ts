import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Referrer } from "../referralService"; // just the type, not the service
import logger from "../../utils/logger";
import { MessageFlags } from "discord.js";
import * as referralService from "../referralService";
import * as authService from "../authService";
import { generateUILink } from "../../utils/authUtils";

// Configuration for admin channel
const ADMIN_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID_ADMIN || '';

type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  function: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Available commands
export const commands: Command[] = [
    {
      data: new SlashCommandBuilder()
        .setName('refresh-leaderboard')
        .setDescription('Refresh the leaderboard')
        .setContexts(InteractionContextType.Guild)
        //this should only allow users with banning capabilities to use the bot.
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
      function: refreshLeaderboard
    },
    {
      data: new SlashCommandBuilder()
        .setName('refresh-me')
        .setDescription('Refresh my leaderboard position')
        .setContexts(InteractionContextType.Guild),
      function: refreshMe
    },
    {
      data: new SlashCommandBuilder()
        .setName('get-codes')
        .setDescription('Get my referral codes')
        .setContexts(InteractionContextType.Guild),
      function: getCodes
    },
    {
      data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Register your address for referral tracking')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option => 
          option.setName('address')
            .setDescription('Your address')
            .setRequired(true)
        ),
      function: signUp
    },
    {
      data: new SlashCommandBuilder()
        .setName('admin-signup')
        .setDescription('Get admin access to the UI')
        .setContexts(InteractionContextType.Guild)
        // Admin command requires permission to kick members (moderator level+)
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
      function: adminAccess
    }
];

async function refreshLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
    try {
        referralService.postLeaderboard(true);
        await interaction.editReply('Leaderboard refresh in process... it might take a few minutes to update.');
    } catch (error) {
        logger.error('Error refreshing leaderboard', { error });
        await interaction.editReply('Failed to refresh leaderboard.');
    }
}

async function refreshMe(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const referrer: Referrer | null = await referralService.getReferrerByDiscordId(interaction.user.id);
  if (!referrer) {
    await interaction.editReply('You are not registered as a referrer.');
    return;
  }
  await interaction.editReply(`You are level ${referrer.level} and have ${referrer.unusedCodes.length} available codes.`);
  const newReferrer = await referralService.refreshReferrerData(referrer.address);
  if (newReferrer && (newReferrer.level !== referrer.level || newReferrer.unusedCodes.length !== referrer.unusedCodes.length)) {
    try {
      await interaction.editReply(`Update: You are level ${newReferrer.level} and have ${newReferrer.unusedCodes.length} available codes.`);
    } catch (error) {
      logger.error('Error refreshing referrer. Will return cached data.', { error });
    }
  }

  // Check if any referrer data has changed
  if (newReferrer && JSON.stringify(referrer) !== JSON.stringify(newReferrer)) {
    try {
      await referralService.postLeaderboard(true);
      await interaction.followUp({ content: 'Leaderboard updated.', ephemeral: true });
    } catch (error) {
      logger.error('Error sending followup about data update', { error });
    }
  }
}

async function getCodes(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  let referrer: Referrer | null = null;
  try {
    // check if user is registered as a referrer
    console.log("interaction.user.id: ", interaction.user.id); 
    referrer = await referralService.getReferrerByDiscordId(interaction.user.id);
  } catch (error) {
    logger.error('Error getting referrer', { error });
    await interaction.editReply('Could not check your referrer status.');
  }
  if (!referrer) {
    await interaction.editReply('You are not registered as a referrer.');
    return;
  }
  let codes: any;
  try {
    codes = await referralService.getAvailableCodes(referrer);
  } catch (error) {
    logger.error('Error getting available codes', { error });
    await interaction.editReply('Failed to get available codes.');
  }
  console.log("codes: ", codes);
  if (codes?.codes?.length > 0) {
    try {
      await interaction.editReply({
        content: `You are level ${referrer.level} and have ${codes.codes.length} available codes.`
      });
      // send codes to user
    } catch (error) {
      logger.error('Error sending editReply to user', { error });
      await interaction.editReply('Failed to send codes to user.');
    }
    try {
      // Create embed with referral links
      const BASE_URL = 'https://claim.superfluid.org/?ref=';
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Your Referral Links')
        .setDescription('Share these links with others to earn rewards!')
        .addFields({
          name: "Links",
          value: codes.codes.map((code: string, i: number) => (
            `${BASE_URL}${code}`
          )).join('\n'),
          inline: true
        })
        .setFooter({ 
          text: "Codes can only be used once. Pick your referrals wisely!"
        });
      await interaction.followUp({ 
        embeds: [embed],
        flags: MessageFlags.Ephemeral 
      });
    } catch (error) {
      logger.error('Error sending ephemeral followup to user', { error });
      await interaction.reply('Failed to send codes to user.');
    }
  } else if (codes.success && codes.codes.length === 0) {
    await interaction.editReply('You have no available codes.');
  } else {
    await interaction.editReply('Failed to get available codes.');
  }
}

async function signUp(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  // check if user is already registered as a referrer
  const referrer: Referrer | null = await referralService.getReferrerByDiscordId(interaction.user.id);
  if (referrer) {
    await interaction.editReply('You are already registered as a referrer.');
    return;
  }
  // check if user has a valid address
  console.log("interaction.options: ", interaction.options);
  const address = interaction.options.getString('address');
  console.log("address: ", address);
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    await interaction.editReply('Invalid address.');
    return;
  }
  if (!address) {
    await interaction.editReply('You must provide an address to register.');
    return;
  }
  // check if address is already registered
  const existingReferrer: Referrer | null = await referralService.getReferrerByAddress(address);
  if (existingReferrer) {
    await interaction.editReply('Address already registered.');
    return;
  }
  // register address
  const p = await referralService.addReferrer(address, interaction.user.displayName, interaction.user.id);
  if (p.success) {
    console.log("user registered: ", p);
    await interaction.editReply('Address registered successfully.');
    await interaction.followUp({ content: 'You can now use the `/get-codes` command to get your referral codes.', ephemeral: true });
  } else {
    await interaction.editReply('Failed to register address.');
  }
}

/**
 * Handle the /admin command to generate UI access
 */
async function adminAccess(interaction: ChatInputCommandInteraction): Promise<void> {
  // Make the response ephemeral (only visible to the user who invoked the command)
  await interaction.deferReply({ ephemeral: true });
  
  // Check if the command is being used in the admin channel
  if (ADMIN_CHANNEL_ID && interaction.channelId !== ADMIN_CHANNEL_ID) {
    await interaction.editReply('This command can only be used in the referral admin channel.');
    logger.discordNotify(`User ${interaction.user.username} (${interaction.user.id}) attempted to use /admin command in unauthorized channel ${interaction.channelId}`);
    return;
  }
  
  try {
    // Check if user is already registered as an admin
    const isRegistered = await authService.isDiscordUserRegistered(interaction.user.id);
    let admin;
    
    if (isRegistered) {
      // Get existing admin data
      admin = await authService.getAdminByDiscordId(interaction.user.id);
      if (!admin) {
        throw new Error('Failed to retrieve admin data');
      }
      
      await interaction.editReply(`You are already registered as an admin. Creating a new auth code.`);
      // delete the existing admin
      await authService.removeAdmin(admin.discordId);
    }
    // Register as a new admin
    admin = await authService.addAdmin(interaction.user.id, interaction.user.username);
    await interaction.editReply(`You've been registered as an admin with access to the UI.`);

    // Generate access link
    const accessLink = generateUILink(admin.authCode);
    
    // Send the access link
    await interaction.followUp({
      content: `Here's your secure access link to the UI:\n${accessLink}\n\nThis link contains your personal access code. Do not share it with others.`,
      ephemeral: true
    });
    
    logger.info(`Admin access link generated for ${interaction.user.username} (${interaction.user.id})`);
    logger.discordNotify(`Admin access link generated for ${interaction.user.username}`);
  } catch (error) {
    logger.error(`Error generating admin access for ${interaction.user.username} (${interaction.user.id})`, { error });
    logger.discordNotify(`Error generating admin access for ${interaction.user.username} (${interaction.user.id})`);
    await interaction.editReply('Failed to generate admin access. Please try again later or contact support.');
  }
}
