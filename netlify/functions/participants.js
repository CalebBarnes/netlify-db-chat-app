import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (httpMethod === "GET") {
    try {
      const query = queryStringParameters?.query || "";
      const limit = parseInt(queryStringParameters?.limit || "20");

      // Get all chat participants with their online status
      // Join with user_presence to get current online status
      let participantsQuery;
      
      if (query.trim()) {
        // Filter by username if query provided
        participantsQuery = sql`
          SELECT 
            cp.username,
            cp.first_seen,
            cp.last_message_at,
            cp.message_count,
            CASE 
              WHEN up.last_seen > NOW() - INTERVAL '30 seconds' THEN 'online'
              WHEN up.last_seen > NOW() - INTERVAL '5 minutes' THEN 'recently_active'
              ELSE 'offline'
            END as status,
            up.last_seen as presence_last_seen,
            up.is_typing,
            up.typing_started_at
          FROM chat_participants cp
          LEFT JOIN user_presence up ON cp.username = up.username
          WHERE LOWER(cp.username) LIKE LOWER(${'%' + query.trim() + '%'})
          ORDER BY 
            CASE 
              WHEN up.last_seen > NOW() - INTERVAL '30 seconds' THEN 1
              WHEN up.last_seen > NOW() - INTERVAL '5 minutes' THEN 2
              ELSE 3
            END,
            cp.last_message_at DESC,
            cp.message_count DESC
          LIMIT ${limit}
        `;
      } else {
        // Get all participants
        participantsQuery = sql`
          SELECT 
            cp.username,
            cp.first_seen,
            cp.last_message_at,
            cp.message_count,
            CASE 
              WHEN up.last_seen > NOW() - INTERVAL '30 seconds' THEN 'online'
              WHEN up.last_seen > NOW() - INTERVAL '5 minutes' THEN 'recently_active'
              ELSE 'offline'
            END as status,
            up.last_seen as presence_last_seen,
            up.is_typing,
            up.typing_started_at
          FROM chat_participants cp
          LEFT JOIN user_presence up ON cp.username = up.username
          ORDER BY 
            CASE 
              WHEN up.last_seen > NOW() - INTERVAL '30 seconds' THEN 1
              WHEN up.last_seen > NOW() - INTERVAL '5 minutes' THEN 2
              ELSE 3
            END,
            cp.last_message_at DESC,
            cp.message_count DESC
          LIMIT ${limit}
        `;
      }

      const participants = await participantsQuery;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          participants,
          total: participants.length,
          query: query.trim(),
          limit
        }),
      };
    } catch (error) {
      console.error("Error fetching participants:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch participants" }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
