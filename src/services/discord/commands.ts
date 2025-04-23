import { 
  CommandInteraction, 
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { Referrer } from "../referralService"; // just the type, not the service
import logger from "../../utils/logger";
import { createLeaderboardEmbed } from "./utils";
import { MessageFlags } from "discord.js";
import * as referralService from "../referralService";

// Command type should use ChatInputCommandInteraction for slash commands
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
