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
      case "GET": {
        const { conversationId, username, sinceId } =
          queryStringParameters || {};

        if (conversationId) {
          // Get messages for a specific conversation
          if (!username) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: "Username is required" }),
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
              body: JSON.stringify({
                error: "Access denied to this conversation",
              }),
            };
          }

          let messages;
          if (sinceId) {
            // Get new messages since specific ID for real-time polling
            messages = await sql`
              SELECT id, sender_username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
              FROM direct_messages
              WHERE conversation_id = ${parseInt(conversationId)} 
              AND id > ${parseInt(sinceId)}
              ORDER BY created_at ASC, id ASC
            `;
          } else {
            // Get recent messages (last 50)
            messages = await sql`
              SELECT id, sender_username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
              FROM direct_messages
              WHERE conversation_id = ${parseInt(conversationId)}
              ORDER BY created_at DESC, id DESC
              LIMIT 50
            `;
            messages.reverse(); // Show oldest first
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(messages),
          };
        } else if (username) {
          // Get all conversations for a user
          const conversations = await sql`
            SELECT 
              c.id,
              c.created_at,
              c.updated_at,
              -- Get the other participant's username (for DMs)
              (
                SELECT cp2.username 
                FROM conversation_participants cp2 
                WHERE cp2.conversation_id = c.id 
                AND cp2.username != ${username.trim()}
                LIMIT 1
              ) as other_username,
              -- Get last message info
              (
                SELECT dm.message 
                FROM direct_messages dm 
                WHERE dm.conversation_id = c.id 
                ORDER BY dm.created_at DESC 
                LIMIT 1
              ) as last_message,
              (
                SELECT dm.sender_username 
                FROM direct_messages dm 
                WHERE dm.conversation_id = c.id 
                ORDER BY dm.created_at DESC 
                LIMIT 1
              ) as last_sender,
              (
                SELECT dm.created_at 
                FROM direct_messages dm 
                WHERE dm.conversation_id = c.id 
                ORDER BY dm.created_at DESC 
                LIMIT 1
              ) as last_message_at,
              -- Calculate unread count
              (
                SELECT COUNT(*) 
                FROM direct_messages dm 
                WHERE dm.conversation_id = c.id 
                AND dm.id > COALESCE(cp.last_read_message_id, 0)
                AND dm.sender_username != ${username.trim()}
              ) as unread_count
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.username = ${username.trim()}
            ORDER BY c.updated_at DESC
          `;

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(conversations),
          };
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "Either conversationId or username is required",
            }),
          };
        }
      }

      case "POST": {
        const {
          username,
          message,
          recipientUsername,
          conversationId,
          replyToId,
          replyToUsername,
          replyPreview,
        } = JSON.parse(body);

        if (!username || !message) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "Username and message are required",
            }),
          };
        }

        let targetConversationId = conversationId;

        if (!targetConversationId && recipientUsername) {
          // Create or get conversation between users
          const [result] = await sql`
            SELECT get_or_create_conversation(${username.trim()}, ${recipientUsername.trim()}) as conversation_id
          `;
          targetConversationId = result.conversation_id;
        }

        if (!targetConversationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "Either conversationId or recipientUsername is required",
            }),
          };
        }

        // Verify user is participant in this conversation
        const participant = await sql`
          SELECT 1 FROM conversation_participants 
          WHERE conversation_id = ${targetConversationId} 
          AND username = ${username.trim()}
        `;

        if (participant.length === 0) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              error: "Access denied to this conversation",
            }),
          };
        }

        // Insert the direct message
        const [newMessage] = await sql`
          INSERT INTO direct_messages (conversation_id, sender_username, message, created_at, reply_to_id, reply_to_username, reply_preview)
          VALUES (${targetConversationId}, ${username.trim()}, ${message.trim()}, NOW(), ${
          replyToId || null
        }, ${replyToUsername || null}, ${replyPreview || null})
          RETURNING id, conversation_id, sender_username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
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
    console.error("Error in direct-messages function:", error);
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
