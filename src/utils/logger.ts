import winston from 'winston';
import { IncomingWebhook } from '@slack/webhook';
import config from '../config';

// Create Slack webhook instance if URL is provided
const slackWebhook = config.slackWebhookUrl 
  ? new IncomingWebhook(config.slackWebhookUrl)
  : null;

// Create Winston logger
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'superfluid-eligibility-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Extend logger with Slack notification method
interface ExtendedLogger extends winston.Logger {
  slackNotify: (message: string, level?: string) => Promise<void>;
}

(logger as ExtendedLogger).slackNotify = async (message: string, level = 'info') => {
  // Log with Winston
  logger.log(level, message);
  
  // Send to Slack if webhook is configured
  if (slackWebhook) {
    try {
      await slackWebhook.send({
        blocks: [
              {
                  type: "section",
                  text: {
                      type: "mrkdwn",
                      text: message
                  }
              }
          ],
      });
    } catch (error) {
      logger.error('Failed to send message to Slack', { error });
    }
  }
};

export default logger as ExtendedLogger; 