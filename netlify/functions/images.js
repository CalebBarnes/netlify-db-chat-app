import { getStore } from "@netlify/blobs";

// Helper function to get the appropriate store based on environment
function getImageStore() {
  const storeOptions = {
    name:
      process.env.CONTEXT === "production" ? "chat-images" : "chat-images-dev",
    consistency: "strong",
  };

  // For local development, manually provide siteID and token
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_TOKEN) {
    storeOptions.siteID = process.env.NETLIFY_SITE_ID;
    storeOptions.token = process.env.NETLIFY_TOKEN;
  }

  return getStore(storeOptions);
}

// Helper function to get content type from filename
function getContentType(filename) {
  const extension = filename.split(".").pop().toLowerCase();
  const contentTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return contentTypes[extension] || "application/octet-stream";
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Extract image key from path
    const pathParts = event.path.split("/");
    const imageKey = pathParts[pathParts.length - 1];

    if (!imageKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Image key is required" }),
      };
    }

    // Get the blob store
    const store = getImageStore();

    // Retrieve the image from Netlify Blobs
    const imageData = await store.getWithMetadata(imageKey, {
      type: "arrayBuffer",
    });

    if (!imageData || !imageData.data) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Image not found" }),
      };
    }

    // Get content type from metadata or filename
    const originalName = imageData.metadata?.originalName || imageKey;
    const contentType = getContentType(originalName);

    // Return the image with appropriate headers
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        "Content-Length": imageData.data.byteLength.toString(),
      },
      body: Buffer.from(imageData.data).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error in images function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to retrieve image",
        message: error.message,
      }),
    };
  }
};
