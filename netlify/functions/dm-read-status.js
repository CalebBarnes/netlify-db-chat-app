import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { username, conversationId, lastReadMessageId } = JSON.parse(event.body);

    if (!username || !conversationId || lastReadMessageId === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: "Username, conversationId, and lastReadMessageId are required" 
        }),
      };
    }

    // Verify user is participant in this conversation
    const participant = await sql`
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = ${parseInt(conversationId)} 
      AND username = ${username.trim()}
    `;

    if (participant.length === 0) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Access denied to this conversation" }),
      };
    }

    // Update the last read message ID for this user in this conversation
    await sql`
      UPDATE conversation_participants 
      SET last_read_message_id = ${parseInt(lastReadMessageId)}
      WHERE conversation_id = ${parseInt(conversationId)} 
      AND username = ${username.trim()}
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error in dm-read-status function:", error);
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
