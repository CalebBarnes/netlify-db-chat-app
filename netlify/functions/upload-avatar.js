import { neon } from "@neondatabase/serverless";
import { getStore } from "@netlify/blobs";

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Get the avatar blob store
function getAvatarStore() {
  return getStore({
    name: "avatars",
    consistency: "strong",
  });
}

// Generate unique key for avatar
function generateAvatarKey(filename, username) {
  const timestamp = Date.now();
  const extension = filename.split(".").pop().toLowerCase();
  return `${username}-${timestamp}.${extension}`;
}

// Helper function to validate avatar file
function validateAvatarFile(file, filename) {
  const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
  const maxSize = 2 * 1024 * 1024; // 2MB for avatars

  // Check file size
  if (file.length > maxSize) {
    throw new Error("Avatar file size too large. Maximum size is 2MB.");
  }

  // Check file extension
  const extension = filename.split(".").pop().toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw new Error("Invalid avatar file type. Allowed types: JPG, PNG, WebP");
  }

  return true;
}

export const handler = async (event) => {
  const { httpMethod } = event;

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { body } = event;

    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file data provided" }),
      };
    }

    // Parse JSON request data
    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON data" }),
      };
    }

    const { username, filename, fileData } = requestData;

    if (!username || !filename || !fileData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Username, filename, and file data are required",
        }),
      };
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(fileData, "base64");

    // Validate the avatar file
    validateAvatarFile(fileBuffer, filename);

    // Generate unique key for the avatar
    const avatarKey = generateAvatarKey(filename, username);

    // Get the blob store
    const store = getAvatarStore();

    // Store the avatar in Netlify Blobs
    await store.set(avatarKey, fileBuffer, {
      metadata: {
        originalName: filename,
        username: username,
        uploadedAt: new Date().toISOString(),
        size: fileBuffer.length,
        type: "avatar",
      },
    });

    // Create the avatar URL
    const avatarUrl = `/api/avatars/${avatarKey}`;

    // Save or update avatar in database
    await sql`
      INSERT INTO user_avatars (username, avatar_url, original_filename, file_size, uploaded_at, updated_at)
      VALUES (${username.trim()}, ${avatarUrl}, ${filename}, ${fileBuffer.length}, NOW(), NOW())
      ON CONFLICT (username) 
      DO UPDATE SET
        avatar_url = EXCLUDED.avatar_url,
        original_filename = EXCLUDED.original_filename,
        file_size = EXCLUDED.file_size,
        updated_at = NOW()
    `;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        avatarUrl: avatarUrl,
        message: "Avatar uploaded successfully",
      }),
    };
  } catch (error) {
    console.error("Avatar upload error:", error);

    // Return appropriate error message
    if (error.message.includes("file size") || error.message.includes("file type")) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to upload avatar" }),
    };
  }
};
