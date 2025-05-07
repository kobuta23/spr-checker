# Discord Bot Commands Reference

This document provides information about all available commands for the referral system Discord bot.

## User Commands

### `/signup <address>`
Register your Ethereum address in the referral system.
- **Parameters**: 
  - `address`: Your Ethereum address (must start with 0x and be 42 characters long)
- **Example**: `/signup 0x1234567890123456789012345678901234567890`

### `/get-codes`
Get your referral codes to share with others.
- **Response**: Shows your available codes, current level, and referral limits

### `/refresh-me`
Refresh your data on the leaderboard.
- **Response**: Confirms that your data is being refreshed

## Admin Commands

These commands require the `Kick Members` permission and can only be used in the admin channel.

### `/refresh-leaderboard`
Trigger a full refresh of the leaderboard data.
- **Response**: Confirms that the leaderboard refresh is in progress

### `/signup-admin`
Register as an admin for the UI access.
- **Response**: Provides a secure access link to the UI

### `/toggle-visibility <user>`
Toggle a user's visibility on the leaderboard.
- **Parameters**:
  - `user`: The user to toggle visibility for. Can be specified in three ways:
    1. Discord mention (e.g., `@username`)
    2. Discord ID (e.g., `123456789012345678`)
    3. Exact username (e.g., `username`)
- **Response**: Confirms the action and logs details about the toggled user
- **Example 1**: `/toggle-visibility @JohnDoe`
- **Example 2**: `/toggle-visibility 123456789012345678`
- **Example 3**: `/toggle-visibility JohnDoe`

### `/list-hidden`
List all users currently hidden from the leaderboard.
- **Response**: Displays information about all hidden users (up to 25 users)

## Notes

- When a user is hidden, they are completely removed from the leaderboard calculations but remain in the database
- Hidden users can be unhidden using the same `/toggle-visibility` command
- When hiding a user, complete details of the action are logged to the admin channel
- The leaderboard is automatically refreshed after any visibility changes 