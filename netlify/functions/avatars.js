import { getStore } from "@netlify/blobs";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=31536000", // Cache for 1 year
};

// Get the avatar blob store
function getAvatarStore() {
  return getStore({
    name: "avatars",
    consistency: "strong",
  });
}

// Helper function to get content type from filename
function getContentType(filename) {
  const extension = filename.split(".").pop().toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export const handler = async (event) => {
  const { httpMethod, path } = event;

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Extract avatar key from path: /api/avatars/{avatarKey}
    const pathParts = path.split("/");
    const avatarKey = pathParts[pathParts.length - 1];

    if (!avatarKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Avatar key is required" }),
      };
    }

    // Get the blob store
    const store = getAvatarStore();

    // Retrieve the avatar from blob storage
    const avatarBlob = await store.get(avatarKey, { type: "arrayBuffer" });

    if (!avatarBlob) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Avatar not found" }),
      };
    }

    // Get metadata to determine content type
    const metadata = await store.getMetadata(avatarKey);
    const originalName = metadata?.originalName || avatarKey;
    const contentType = getContentType(originalName);

    // Return the avatar image
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Content-Length": avatarBlob.byteLength.toString(),
      },
      body: Buffer.from(avatarBlob).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Avatar retrieval error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to retrieve avatar" }),
    };
  }
};
