import { neon } from "@netlify/neon";

const sql = neon();

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { httpMethod, body } = event;

    switch (httpMethod) {
      case 'GET':
        // Get all active users (last seen within 30 seconds)
        const activeUsers = await sql`
          SELECT username, last_seen 
          FROM user_presence 
          WHERE last_seen > NOW() - INTERVAL '30 seconds'
          ORDER BY username ASC
        `;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(activeUsers),
        };

      case 'POST':
        // Update user presence (heartbeat)
        const { username } = JSON.parse(body);
        
        if (!username || !username.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Username is required' }),
          };
        }

        // Upsert user presence
        await sql`
          INSERT INTO user_presence (username, last_seen)
          VALUES (${username.trim()}, NOW())
          ON CONFLICT (username) 
          DO UPDATE SET last_seen = NOW()
        `;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true }),
        };

      case 'DELETE':
        // Remove user from presence (when they leave)
        const { username: usernameToRemove } = JSON.parse(body);
        
        if (!usernameToRemove || !usernameToRemove.trim()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Username is required' }),
          };
        }

        await sql`
          DELETE FROM user_presence 
          WHERE username = ${usernameToRemove.trim()}
        `;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true }),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in presence function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};
