import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  try {
    const { httpMethod, body, queryStringParameters } = event;

    switch (httpMethod) {
      case "GET":
        // Get messages, optionally since a specific timestamp for real-time updates
        const since = queryStringParameters?.since;
        let messages;

        const sinceId = queryStringParameters?.sinceId;

        if (sinceId) {
          // Get messages with ID greater than sinceId (most reliable for real-time polling)
          messages = await sql`
            SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
            FROM messages
            WHERE id > ${parseInt(sinceId)}
            ORDER BY created_at ASC, id ASC
          `;
        } else if (since) {
          // Fallback to timestamp-based filtering
          messages = await sql`
            SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
            FROM messages
            WHERE created_at > ${since}
            ORDER BY created_at ASC, id ASC
          `;
        } else {
          // Get recent messages (last 50)
          messages = await sql`
            SELECT id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
            FROM messages
            ORDER BY created_at DESC
            LIMIT 50
          `;
          // Reverse to show oldest first
          messages.reverse();
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(messages),
        };

      case "POST": {
        // Send a new message
        const { username, message, replyToId, replyToUsername, replyPreview } =
          JSON.parse(body);

        if (!username || !username.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Username is required" }),
          };
        }

        if (!message || !message.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Message is required" }),
          };
        }

        // Validate username length
        if (username.trim().length > 50) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "Username must be 50 characters or less",
            }),
          };
        }

        // Validate message length
        if (message.trim().length > 1000) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "Message must be 1000 characters or less",
            }),
          };
        }

        // Validate reply data if provided
        if (replyToId) {
          // Ensure replyToId is a valid integer
          const replyId = parseInt(replyToId);
          if (isNaN(replyId) || replyId <= 0) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: "Reply ID must be a valid positive integer",
              }),
            };
          }

          // Ensure reply metadata is provided
          if (!replyToUsername || !replyPreview) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: "Reply requires both username and preview",
              }),
            };
          }
        }

        const [newMessage] = await sql`
          INSERT INTO messages (username, message, created_at, reply_to_id, reply_to_username, reply_preview)
          VALUES (${username.trim()}, ${message.trim()}, NOW(), ${
          replyToId || null
        }, ${replyToUsername || null}, ${replyPreview || null})
          RETURNING id, username, message, created_at, reply_to_id, reply_to_username, reply_preview
        `;

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newMessage),
        };
      }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: "Method not allowed" }),
        };
    }
  } catch (error) {
    console.error("Error in messages function:", error);
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
