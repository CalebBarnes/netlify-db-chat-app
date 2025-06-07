import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const path = event.path.replace('/api/spotify-control', '');
    
    switch (event.httpMethod) {
      case 'GET':
        if (path === '/search') {
          return handleSearch(event);
        } else if (path === '/devices') {
          return handleGetDevices(event);
        } else if (path === '/current') {
          return handleGetCurrentTrack(event);
        }
        break;
        
      case 'POST':
        if (path === '/play') {
          return handlePlay(event);
        } else if (path === '/pause') {
          return handlePause(event);
        } else if (path === '/skip') {
          return handleSkip(event);
        } else if (path === '/queue') {
          return handleAddToQueue(event);
        }
        break;
        
      case 'PUT':
        if (path === '/volume') {
          return handleSetVolume(event);
        } else if (path === '/seek') {
          return handleSeek(event);
        }
        break;
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    console.error('Spotify control error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Get valid access token for user
async function getAccessToken(username) {
  const [token] = await sql`
    SELECT access_token, refresh_token, expires_at 
    FROM spotify_tokens 
    WHERE username = ${username}
  `;

  if (!token) {
    throw new Error('No Spotify connection found');
  }

  // Check if token is expired
  if (new Date(token.expires_at) <= new Date()) {
    // Try to refresh token
    const refreshResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error('Token refresh failed');
    }

    const newTokens = await refreshResponse.json();
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    
    await sql`
      UPDATE spotify_tokens 
      SET access_token = ${newTokens.access_token}, expires_at = ${expiresAt}
      WHERE username = ${username}
    `;

    return newTokens.access_token;
  }

  return token.access_token;
}

// Make authenticated Spotify API request
async function spotifyRequest(username, endpoint, options = {}) {
  const accessToken = await getAccessToken(username);
  
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Spotify API error: ${error.error?.message || error.error || 'Unknown error'}`);
  }

  return response.status === 204 ? null : response.json();
}

// Search for tracks
async function handleSearch(event) {
  const { username, query, type = 'track', limit = 20 } = event.queryStringParameters || {};

  if (!username || !query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username and query are required' }),
    };
  }

  try {
    const results = await spotifyRequest(username, `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Get user's devices
async function handleGetDevices(event) {
  const { username } = event.queryStringParameters || {};

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  try {
    const devices = await spotifyRequest(username, '/me/player/devices');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(devices),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Get current playing track
async function handleGetCurrentTrack(event) {
  const { username } = event.queryStringParameters || {};

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  try {
    const current = await spotifyRequest(username, '/me/player/currently-playing');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(current || { is_playing: false }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Play track or resume playback
async function handlePlay(event) {
  const { username, sessionId, trackUri, deviceId, position = 0 } = JSON.parse(event.body || '{}');

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  try {
    const playOptions = {
      method: 'PUT',
      body: JSON.stringify({
        ...(trackUri && { uris: [trackUri] }),
        position_ms: position,
      }),
    };

    const endpoint = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
    await spotifyRequest(username, endpoint, playOptions);

    // Update session state if provided
    if (sessionId && trackUri) {
      const trackInfo = await spotifyRequest(username, `/tracks/${trackUri.split(':')[2]}`);
      
      await sql`
        UPDATE jam_sessions 
        SET current_track_uri = ${trackUri},
            current_track_name = ${trackInfo.name},
            current_track_artist = ${trackInfo.artists[0].name},
            current_position = ${position},
            is_playing = true,
            last_updated = NOW()
        WHERE id = ${sessionId}
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Pause playback
async function handlePause(event) {
  const { username, sessionId } = JSON.parse(event.body || '{}');

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  try {
    await spotifyRequest(username, '/me/player/pause', { method: 'PUT' });

    // Update session state if provided
    if (sessionId) {
      await sql`
        UPDATE jam_sessions 
        SET is_playing = false, last_updated = NOW()
        WHERE id = ${sessionId}
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Skip to next track
async function handleSkip(event) {
  const { username, sessionId } = JSON.parse(event.body || '{}');

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  try {
    await spotifyRequest(username, '/me/player/next', { method: 'POST' });

    // Get next track info and update session
    if (sessionId) {
      // Wait a moment for Spotify to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const current = await spotifyRequest(username, '/me/player/currently-playing');
      
      if (current && current.item) {
        await sql`
          UPDATE jam_sessions 
          SET current_track_uri = ${current.item.uri},
              current_track_name = ${current.item.name},
              current_track_artist = ${current.item.artists[0].name},
              current_position = ${current.progress_ms || 0},
              is_playing = ${current.is_playing},
              last_updated = NOW()
          WHERE id = ${sessionId}
        `;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Add track to queue
async function handleAddToQueue(event) {
  const { username, sessionId, trackUri } = JSON.parse(event.body || '{}');

  if (!username || !trackUri) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username and track URI are required' }),
    };
  }

  try {
    // Add to Spotify queue
    await spotifyRequest(username, `/me/player/queue?uri=${encodeURIComponent(trackUri)}`, { method: 'POST' });

    // Add to session queue if provided
    if (sessionId) {
      const trackInfo = await spotifyRequest(username, `/tracks/${trackUri.split(':')[2]}`);
      
      // Get next position in queue
      const [maxPosition] = await sql`
        SELECT COALESCE(MAX(position), 0) as max_pos FROM session_queue WHERE session_id = ${sessionId}
      `;

      await sql`
        INSERT INTO session_queue (session_id, track_uri, track_name, track_artist, added_by, position)
        VALUES (${sessionId}, ${trackUri}, ${trackInfo.name}, ${trackInfo.artists[0].name}, ${username}, ${maxPosition.max_pos + 1})
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Set volume
async function handleSetVolume(event) {
  const { username, sessionId, volume } = JSON.parse(event.body || '{}');

  if (!username || typeof volume !== 'number') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username and volume are required' }),
    };
  }

  const clampedVolume = Math.max(0, Math.min(100, volume));

  try {
    await spotifyRequest(username, `/me/player/volume?volume_percent=${clampedVolume}`, { method: 'PUT' });

    // Update session volume if provided
    if (sessionId) {
      await sql`
        UPDATE jam_sessions 
        SET volume = ${clampedVolume}, last_updated = NOW()
        WHERE id = ${sessionId}
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Seek to position
async function handleSeek(event) {
  const { username, sessionId, position } = JSON.parse(event.body || '{}');

  if (!username || typeof position !== 'number') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username and position are required' }),
    };
  }

  try {
    await spotifyRequest(username, `/me/player/seek?position_ms=${position}`, { method: 'PUT' });

    // Update session position if provided
    if (sessionId) {
      await sql`
        UPDATE jam_sessions 
        SET current_position = ${position}, last_updated = NOW()
        WHERE id = ${sessionId}
      `;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
