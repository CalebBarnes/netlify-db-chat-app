import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://lumi-chat.netlify.app/api/spotify-auth/callback';

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const path = event.path.replace('/api/spotify-auth', '');
    
    switch (event.httpMethod) {
      case 'GET':
        if (path === '/login') {
          return handleLogin(event);
        } else if (path === '/callback') {
          return handleCallback(event);
        } else if (path === '/status') {
          return handleStatus(event);
        }
        break;
        
      case 'POST':
        if (path === '/refresh') {
          return handleRefresh(event);
        } else if (path === '/logout') {
          return handleLogout(event);
        }
        break;
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    console.error('Spotify auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Generate Spotify OAuth login URL
async function handleLogin(event) {
  const { username } = event.queryStringParameters || {};
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
  ].join(' ');

  const state = Buffer.from(JSON.stringify({ username })).toString('base64');
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SPOTIFY_CLIENT_ID);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.set('state', state);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ authUrl: authUrl.toString() }),
  };
}

// Handle OAuth callback
async function handleCallback(event) {
  const { code, state, error } = event.queryStringParameters || {};
  
  if (error) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <html>
          <body>
            <h1>Spotify Authorization Error</h1>
            <p>Error: ${error}</p>
            <script>window.close();</script>
          </body>
        </html>
      `,
    };
  }

  if (!code || !state) {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <html>
          <body>
            <h1>Missing Authorization Code</h1>
            <script>window.close();</script>
          </body>
        </html>
      `,
    };
  }

  try {
    const { username } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    const tokens = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokens.error_description}`);
    }

    // Get user info
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    
    const userInfo = await userResponse.json();
    
    if (!userResponse.ok) {
      throw new Error(`User info failed: ${userInfo.error.message}`);
    }

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    await sql`
      INSERT INTO spotify_tokens (username, access_token, refresh_token, expires_at, spotify_user_id, updated_at)
      VALUES (${username}, ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt}, ${userInfo.id}, NOW())
      ON CONFLICT (username) 
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        spotify_user_id = EXCLUDED.spotify_user_id,
        updated_at = NOW()
    `;

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <html>
          <body>
            <h1>🎵 Spotify Connected Successfully!</h1>
            <p>Welcome, ${userInfo.display_name}! You can now join jam sessions.</p>
            <script>
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: `
        <html>
          <body>
            <h1>Connection Failed</h1>
            <p>Error: ${error.message}</p>
            <script>window.close();</script>
          </body>
        </html>
      `,
    };
  }
}

// Check Spotify connection status
async function handleStatus(event) {
  const { username } = event.queryStringParameters || {};
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  const [token] = await sql`
    SELECT spotify_user_id, expires_at
    FROM spotify_tokens
    WHERE username = ${username}
  `;

  const isConnected = token && new Date(token.expires_at) > new Date();
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      connected: isConnected,
      spotifyUserId: token?.spotify_user_id || null,
    }),
  };
}

// Refresh expired tokens
async function handleRefresh(event) {
  const { username } = JSON.parse(event.body || '{}');
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  const [token] = await sql`
    SELECT refresh_token FROM spotify_tokens WHERE username = ${username}
  `;

  if (!token) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'No Spotify connection found' }),
    };
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });

  const newTokens = await response.json();
  
  if (!response.ok) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Token refresh failed' }),
    };
  }

  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
  
  await sql`
    UPDATE spotify_tokens 
    SET access_token = ${newTokens.access_token},
        expires_at = ${expiresAt},
        updated_at = NOW()
    WHERE username = ${username}
  `;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

// Logout and remove tokens
async function handleLogout(event) {
  const { username } = JSON.parse(event.body || '{}');
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  await sql`DELETE FROM spotify_tokens WHERE username = ${username}`;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}
