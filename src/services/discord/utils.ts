import { Referrer } from "../referralService";
import { EmbedBuilder } from "discord.js";
import { formatSUPIncome } from "../../utils/formatter";
import { LEVEL_EMOJIS, LEVEL_DESCRIPTIONS } from "../../config/levels";

/**
 * Create a formatted embed for the leaderboard
 */
export const createLeaderboardEmbed = (referrers: Referrer[]): EmbedBuilder => {
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
      ) + BigInt(referrer.SUPincome);
      
      // Format the username to fixed width
      const username = referrer.username.length > 15 
        ? `${referrer.username.substring(0, 12)}...` 
        : referrer.username;
      
      // Format SUP income to be more readable
      const formattedSUP = formatSUPIncome(totalSUPincome.toString());
      
      // Get level emoji
      const levelEmoji = LEVEL_EMOJIS[referrer.level as keyof typeof LEVEL_EMOJIS] || '⭐';
      
      // Format referral count with max referrals
      const referralCount = `${referrer.referrals.length}/${referrer.maxReferrals}`;
      
      leaderboardText += `**${index + 1}.** ${levelEmoji} ${username} - ${referralCount} refs - ${formattedSUP}\n`;
      
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
    
    // Add legend for level emojis
    embed.addFields({ 
      name: 'Level System',
      value: [4, 3, 2, 1].map(level => 
        // @ts-ignore
        `${LEVEL_EMOJIS[level]} ${LEVEL_DESCRIPTIONS[level]}`
      ).join('\n'),
      inline: false
    });
    
    return embed;
  };