import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
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
      const username = queryStringParameters?.username;

      if (!username) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Username is required" }),
        };
      }

      // Get user avatar information
      const [avatar] = await sql`
        SELECT username, avatar_url, original_filename, file_size, uploaded_at, updated_at
        FROM user_avatars
        WHERE username = ${username.trim()}
      `;

      if (!avatar) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: "Avatar not found",
            hasAvatar: false 
          }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          hasAvatar: true,
          avatar: {
            username: avatar.username,
            avatarUrl: avatar.avatar_url,
            originalFilename: avatar.original_filename,
            fileSize: avatar.file_size,
            uploadedAt: avatar.uploaded_at,
            updatedAt: avatar.updated_at,
          },
        }),
      };
    } catch (error) {
      console.error("Error fetching user avatar:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to fetch avatar" }),
      };
    }
  }

  if (httpMethod === "DELETE") {
    try {
      const username = queryStringParameters?.username;

      if (!username) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Username is required" }),
        };
      }

      // Delete user avatar from database
      const result = await sql`
        DELETE FROM user_avatars
        WHERE username = ${username.trim()}
        RETURNING avatar_url
      `;

      if (result.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Avatar not found" }),
        };
      }

      // Note: We could also delete from blob storage here, but keeping it for now
      // in case we want to implement avatar history or recovery

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "Avatar deleted successfully",
        }),
      };
    } catch (error) {
      console.error("Error deleting user avatar:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to delete avatar" }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
