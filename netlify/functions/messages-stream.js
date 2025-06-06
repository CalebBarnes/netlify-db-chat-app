import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { queryStringParameters } = event;
    const sinceId = queryStringParameters?.sinceId;

    // For SSE, we'll do a one-time check for new messages
    // In a real implementation, you'd want to keep the connection open
    // but Netlify Functions have a 10-second timeout, so we'll use this as a long-polling approach

    let messages = [];

    if (sinceId) {
      messages = await sql`
        SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
        FROM messages
        WHERE id > ${parseInt(sinceId)}
        ORDER BY created_at ASC, id ASC
      `;
    } else {
      // Get recent messages if no sinceId provided
      messages = await sql`
        SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
        FROM messages
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `;
      messages.reverse();
    }

    // Format as Server-Sent Events
    let sseData = "";

    if (messages.length > 0) {
      messages.forEach((message) => {
        sseData += `data: ${JSON.stringify(message)}\n\n`;
      });
    } else {
      // Send a heartbeat if no new messages
      sseData = `data: {"type": "heartbeat"}\n\n`;
    }

    return {
      statusCode: 200,
      headers,
      body: sseData,
    };
  } catch (error) {
    console.error("Error in messages-stream function:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
