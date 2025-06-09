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
    const { username, recipientUsername } = JSON.parse(event.body);

    if (!username || !recipientUsername) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Username and recipientUsername are required",
        }),
      };
    }

    // Prevent users from creating conversations with themselves
    if (username.trim() === recipientUsername.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Cannot create conversation with yourself",
        }),
      };
    }

    // Create or get conversation between users (this will create an empty conversation)
    const [result] = await sql`
      SELECT get_or_create_conversation(${username.trim()}, ${recipientUsername.trim()}) as conversation_id
    `;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        conversation_id: result.conversation_id,
        participants: [username.trim(), recipientUsername.trim()],
      }),
    };
  } catch (error) {
    console.error("Error in create-conversation function:", error);
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
