"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Register a Telegram webhook by calling the Telegram Bot API
 *
 * This action calls Telegram's setWebhook API to register our Convex HTTP endpoint
 * as the webhook URL for the bot.
 */
export const registerTelegramWebhook = action({
  args: {
    connectionId: v.id("channelConnections"),
    webhookUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { connectionId, webhookUrl } = args;

    // Get the decrypted bot token
    const connectionData = await ctx.runAction(internal.channelConnectionsActions.getDecryptedBotToken, {
      connectionId,
    });

    if (!connectionData) {
      throw new Error("Channel connection not found or bot token missing");
    }

    const { botToken, botUsername } = connectionData;

    // Call Telegram setWebhook API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;

    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${errorText}`);
    }

    const result = await response.json() as { ok: boolean; result: boolean; description?: string };

    if (!result.ok || !result.result) {
      throw new Error(`Failed to register webhook: ${result.description || "Unknown error"}`);
    }

    return {
      success: true,
      webhookUrl,
      botUsername,
    };
  },
});

/**
 * Verify a Telegram bot token by calling getMe API
 */
export const verifyTelegramBot = action({
  args: {
    botToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const telegramApiUrl = `https://api.telegram.org/bot${args.botToken}/getMe`;

    const response = await fetch(telegramApiUrl);

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const result = await response.json() as { ok: boolean; result?: { username: string; first_name: string; id: number } };

    if (!result.ok || !result.result) {
      throw new Error("Invalid bot token");
    }

    return {
      success: true,
      botUsername: result.result.username,
      botFirstName: result.result.first_name,
      botId: result.result.id,
    };
  },
});
