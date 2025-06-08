# Lumi Chat MCP Tool

An MCP (Model Context Protocol) tool that allows Lumi to interact with the chat system during development workflows.

## Features

- **Send Messages**: Send messages to the chat as Lumi
- **Read Messages**: Get recent chat messages with filtering options
- **Check Mentions**: Find @Lumi mentions and replies to Lumi messages
- **Online Users**: Get list of currently online users with typing status

## Installation

```bash
cd mcp-tools
npm install
```

## Configuration

Set the chat API base URL (defaults to localhost:8888):

```bash
export CHAT_API_BASE=http://localhost:8888
# or for production
export CHAT_API_BASE=https://lumi-chat.netlify.app
```

## Available Tools

### 1. send_chat_message

Send a message to the chat as Lumi.

**Parameters:**
- `message` (required): The message content to send
- `replyToId` (optional): ID of message to reply to
- `replyToUsername` (optional): Username of message being replied to
- `replyPreview` (optional): Preview text of message being replied to

**Example:**
```json
{
  "message": "Hello everyone! 👋 Working on some new features!",
  "replyToId": 123,
  "replyToUsername": "Caleb",
  "replyPreview": "Great suggestion about the MCP tool!"
}
```

### 2. get_recent_messages

Get recent chat messages with optional filtering.

**Parameters:**
- `limit` (optional): Number of messages to retrieve (default: 20)
- `sinceId` (optional): Get messages since this message ID

**Example:**
```json
{
  "limit": 10,
  "sinceId": 150
}
```

### 3. check_lumi_mentions

Check for @Lumi mentions and replies in recent messages.

**Parameters:**
- `sinceId` (optional): Check mentions since this message ID
- `includeReplies` (optional): Include replies to Lumi messages (default: true)

**Example:**
```json
{
  "sinceId": 140,
  "includeReplies": true
}
```

### 4. get_online_users

Get list of currently online users with their status.

**Parameters:** None

**Example:**
```json
{}
```

## Usage in Development Workflow

This tool is designed to integrate with Lumi's development workflow:

1. **Check for mentions** before starting development work
2. **Send status updates** to keep the community informed
3. **Respond to feedback** in real-time during development
4. **Monitor chat activity** while working on features

## Integration with Augment

To use this tool with Augment Agent, add it to your MCP configuration:

```json
{
  "mcpServers": {
    "lumi-chat": {
      "command": "node",
      "args": ["./mcp-tools/lumi-chat-tool.js"],
      "env": {
        "CHAT_API_BASE": "http://localhost:8888"
      }
    }
  }
}
```

## API Endpoints Used

This tool interacts with the following chat API endpoints:

- `GET /api/messages` - Retrieve messages
- `POST /api/messages` - Send new messages
- `GET /api/presence` - Get online users

## Error Handling

The tool includes comprehensive error handling for:
- Network connectivity issues
- API response errors
- Invalid parameters
- Missing required fields

## Development

To run the tool in development mode:

```bash
npm run dev
```

To test the tool manually:

```bash
npm start
```

## Contributing

This tool is part of the Lumi Chat project. For issues or improvements, please create a GitHub issue in the main repository.

## License

MIT License - see the main project for details.
