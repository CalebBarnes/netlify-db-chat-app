#!/usr/bin/env node

/**
 * MCP Tool for Lumi Chat Interaction
 * 
 * This tool allows Lumi to interact with the chat system during development:
 * - Send messages to the chat as Lumi
 * - Read recent chat messages
 * - Check for @Lumi mentions and replies
 * - Filter messages by criteria
 * 
 * Usage: This tool integrates with the MCP (Model Context Protocol) system
 * to provide seamless chat interaction during development workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration
const CHAT_API_BASE = process.env.CHAT_API_BASE || 'http://localhost:8888';
const LUMI_USERNAME = 'Lumi';

class LumiChatTool {
  constructor() {
    this.server = new Server(
      {
        name: 'lumi-chat-tool',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_chat_message',
            description: 'Send a message to the chat as Lumi',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The message content to send',
                },
                replyToId: {
                  type: 'number',
                  description: 'Optional: ID of message to reply to',
                },
                replyToUsername: {
                  type: 'string',
                  description: 'Optional: Username of message being replied to',
                },
                replyPreview: {
                  type: 'string',
                  description: 'Optional: Preview text of message being replied to',
                },
              },
              required: ['message'],
            },
          },
          {
            name: 'get_recent_messages',
            description: 'Get recent chat messages',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of messages to retrieve (default: 20)',
                  default: 20,
                },
                sinceId: {
                  type: 'number',
                  description: 'Get messages since this message ID',
                },
              },
              required: [],
            },
          },
          {
            name: 'check_lumi_mentions',
            description: 'Check for @Lumi mentions and replies in recent messages',
            inputSchema: {
              type: 'object',
              properties: {
                sinceId: {
                  type: 'number',
                  description: 'Check mentions since this message ID',
                },
                includeReplies: {
                  type: 'boolean',
                  description: 'Include replies to Lumi messages (default: true)',
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: 'get_online_users',
            description: 'Get list of currently online users',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'send_chat_message':
            return await this.sendChatMessage(args);
          case 'get_recent_messages':
            return await this.getRecentMessages(args);
          case 'check_lumi_mentions':
            return await this.checkLumiMentions(args);
          case 'get_online_users':
            return await this.getOnlineUsers(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async sendChatMessage(args) {
    const { message, replyToId, replyToUsername, replyPreview } = args;

    if (!message || !message.trim()) {
      throw new Error('Message content is required');
    }

    const payload = {
      username: LUMI_USERNAME,
      message: message.trim(),
      replyToId: replyToId || null,
      replyToUsername: replyToUsername || null,
      replyPreview: replyPreview || null,
    };

    const response = await fetch(`${CHAT_API_BASE}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: `Message sent successfully!\n\nMessage ID: ${result.id}\nUsername: ${result.username}\nContent: ${result.message}\nTimestamp: ${result.created_at}${
            result.reply_to_id ? `\nReply to: ${result.reply_to_username} (ID: ${result.reply_to_id})` : ''
          }`,
        },
      ],
    };
  }

  async getRecentMessages(args) {
    const { limit = 20, sinceId } = args;

    let url = `${CHAT_API_BASE}/api/messages`;
    if (sinceId) {
      url += `?sinceId=${sinceId}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.status} ${response.statusText}`);
    }

    let messages = await response.json();

    // If no sinceId was provided, limit the results
    if (!sinceId && limit) {
      messages = messages.slice(-limit);
    }

    const messageText = messages.length > 0 
      ? messages.map(msg => {
          const replyInfo = msg.reply_to_id ? ` (replying to ${msg.reply_to_username})` : '';
          return `[${msg.id}] ${msg.username}${replyInfo}: ${msg.message} (${new Date(msg.created_at).toLocaleTimeString()})`;
        }).join('\n')
      : 'No messages found.';

    return {
      content: [
        {
          type: 'text',
          text: `Recent Messages (${messages.length} found):\n\n${messageText}`,
        },
      ],
    };
  }

  async checkLumiMentions(args) {
    const { sinceId, includeReplies = true } = args;

    let url = `${CHAT_API_BASE}/api/messages`;
    if (sinceId) {
      url += `?sinceId=${sinceId}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.status} ${response.statusText}`);
    }

    const messages = await response.json();

    // Filter for @Lumi mentions and replies to Lumi
    const mentions = messages.filter(msg => {
      // Check for @Lumi mentions in message content
      const hasMention = msg.message.toLowerCase().includes('@lumi');
      
      // Check for replies to Lumi messages
      const isReplyToLumi = includeReplies && msg.reply_to_username === LUMI_USERNAME;
      
      // Don't include Lumi's own messages
      const isNotFromLumi = msg.username !== LUMI_USERNAME;
      
      return isNotFromLumi && (hasMention || isReplyToLumi);
    });

    const mentionText = mentions.length > 0
      ? mentions.map(msg => {
          const type = msg.message.toLowerCase().includes('@lumi') ? 'MENTION' : 'REPLY';
          const replyInfo = msg.reply_to_id ? ` (replying to ${msg.reply_to_username})` : '';
          return `[${type}] [${msg.id}] ${msg.username}${replyInfo}: ${msg.message} (${new Date(msg.created_at).toLocaleTimeString()})`;
        }).join('\n')
      : 'No @Lumi mentions or replies found.';

    return {
      content: [
        {
          type: 'text',
          text: `@Lumi Mentions and Replies (${mentions.length} found):\n\n${mentionText}`,
        },
      ],
    };
  }

  async getOnlineUsers(args) {
    const response = await fetch(`${CHAT_API_BASE}/api/presence`);

    if (!response.ok) {
      throw new Error(`Failed to get online users: ${response.status} ${response.statusText}`);
    }

    const users = await response.json();

    const userText = users.length > 0
      ? users.map(user => {
          const typingStatus = user.is_typing ? ' (typing...)' : '';
          return `• ${user.username}${typingStatus} (last seen: ${new Date(user.last_seen).toLocaleTimeString()})`;
        }).join('\n')
      : 'No users currently online.';

    return {
      content: [
        {
          type: 'text',
          text: `Online Users (${users.length} found):\n\n${userText}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Lumi Chat MCP Tool started');
  }
}

// Start the server
const tool = new LumiChatTool();
tool.run().catch(console.error);
