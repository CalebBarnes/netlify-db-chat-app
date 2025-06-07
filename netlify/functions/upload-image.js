import { getStore } from "@netlify/blobs";
import { neon } from "@netlify/neon";

const sql = neon();

// Helper function to get the shared image store for both dev and prod
function getImageStore() {
  const storeOptions = {
    name: "chat-images", // Use same store for both dev and prod for seamless feedback
    consistency: "strong",
  };

  // For local development, manually provide siteID and token
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_TOKEN) {
    storeOptions.siteID = process.env.NETLIFY_SITE_ID;
    storeOptions.token = process.env.NETLIFY_TOKEN;
  }

  return getStore(storeOptions);
}

// Helper function to generate unique filename
function generateImageKey(originalName, username) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split(".").pop().toLowerCase();
  return `${username}/${timestamp}-${randomId}.${extension}`;
}

// Helper function to validate image file
function validateImageFile(file, filename) {
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  // Check file size
  if (file.length > maxSize) {
    throw new Error("File size too large. Maximum size is 10MB.");
  }

  // Check file extension
  const extension = filename.split(".").pop().toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    throw new Error("Invalid file type. Allowed types: JPG, PNG, WebP, GIF");
  }

  return true;
}

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

    const {
      username,
      filename,
      fileData,
      message,
      replyToId,
      replyToUsername,
      replyPreview,
    } = requestData;

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

    // Validate the image file
    validateImageFile(fileBuffer, filename);

    // Generate unique key for the image
    const imageKey = generateImageKey(filename, username);

    // Get the blob store
    const store = getImageStore();

    // Store the image in Netlify Blobs
    await store.set(imageKey, fileBuffer, {
      metadata: {
        originalName: filename,
        username: username,
        uploadedAt: new Date().toISOString(),
        size: fileBuffer.length,
      },
    });

    // Create the image URL
    const imageUrl = `/api/images/${imageKey}`;

    // Save message with image to database
    const messageText = message || `📷 ${filename}`;

    const [newMessage] = await sql`
      INSERT INTO messages (username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename)
      VALUES (${username.trim()}, ${messageText}, NOW(), ${
      replyToId || null
    }, ${replyToUsername || null}, ${
      replyPreview || null
    }, ${imageUrl}, ${filename})
      RETURNING id, username, message, created_at, reply_to_id, reply_to_username, reply_preview, image_url, image_filename
    `;

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: newMessage,
        imageUrl: imageUrl,
      }),
    };
  } catch (error) {
    console.error("Error in upload-image function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to upload image",
        message: error.message,
      }),
    };
  }
};
