import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { sinceId, username } = event.queryStringParameters || {};

    // Validate required parameters
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Username is required" }),
      };
    }

    // Additional username validation
    if (
      typeof username !== "string" ||
      username.trim().length === 0 ||
      username.length > 50
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid username format" }),
      };
    }

    // Fetch all chat state data in parallel for better performance
    const [messagesResult, presenceResult] = await Promise.all([
      fetchMessages(sinceId),
      fetchPresenceAndTyping(),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        messages: messagesResult,
        presence: presenceResult.users,
        typing: presenceResult.typing,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Error in chat-state function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};

// Helper function to fetch messages (replicates /api/messages logic)
async function fetchMessages(sinceId) {
  try {
    let messages;

    if (sinceId) {
      // Get messages with ID greater than sinceId (for real-time polling)
      messages = await sql`
        SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
        FROM messages
        WHERE id > ${parseInt(sinceId)}
        ORDER BY created_at ASC, id ASC
      `;
    } else {
      // Get recent messages (last 50)
      messages = await sql`
        SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
        FROM messages
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `;
      messages.reverse(); // Show oldest first
    }

    return messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

// Helper function to fetch presence and typing data (replicates /api/presence logic)
async function fetchPresenceAndTyping() {
  try {
    // Get all active users with their typing status
    const users = await sql`
      SELECT username, last_seen, is_typing
      FROM user_presence
      WHERE last_seen > NOW() - INTERVAL '30 seconds'
      ORDER BY username ASC
    `;

    // Extract typing users in a single pass
    const typingUsers = [];
    const processedUsers = users.map((user) => {
      if (user.is_typing) {
        typingUsers.push(user.username);
      }
      return {
        username: user.username,
        last_seen: user.last_seen,
        is_typing: user.is_typing,
      };
    });

    return {
      users: processedUsers,
      typing: typingUsers,
    };
  } catch (error) {
    console.error("Error fetching presence:", error);
    throw error;
  }
}
