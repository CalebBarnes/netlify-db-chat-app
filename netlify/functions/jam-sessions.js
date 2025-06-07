import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return handleGetSessions(event);
      case 'POST':
        return handleCreateSession(event);
      case 'PUT':
        return handleUpdateSession(event);
      case 'DELETE':
        return handleEndSession(event);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Jam sessions error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Get active jam sessions
async function handleGetSessions(event) {
  const { sessionId, username } = event.queryStringParameters || {};

  if (sessionId) {
    // Get specific session with participants
    const [session] = await sql`
      SELECT js.*, 
             array_agg(
               json_build_object(
                 'username', sp.username,
                 'spotify_user_id', sp.spotify_user_id,
                 'joined_at', sp.joined_at,
                 'last_seen', sp.last_seen
               )
             ) as participants
      FROM jam_sessions js
      LEFT JOIN session_participants sp ON js.id = sp.session_id
      WHERE js.id = ${sessionId} AND js.ended_at IS NULL
      GROUP BY js.id
    `;

    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    // Get current queue
    const queue = await sql`
      SELECT * FROM session_queue 
      WHERE session_id = ${sessionId}
      ORDER BY position ASC
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        session: {
          ...session,
          participants: session.participants.filter(p => p.username !== null),
          queue,
        },
      }),
    };
  }

  // Get all active sessions
  const sessions = await sql`
    SELECT js.*, 
           COUNT(sp.username) as participant_count,
           array_agg(sp.username) FILTER (WHERE sp.username IS NOT NULL) as participant_usernames
    FROM jam_sessions js
    LEFT JOIN session_participants sp ON js.id = sp.session_id
    WHERE js.ended_at IS NULL
    GROUP BY js.id
    ORDER BY js.created_at DESC
  `;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ sessions }),
  };
}

// Create new jam session
async function handleCreateSession(event) {
  const { username, sessionName } = JSON.parse(event.body || '{}');

  if (!username || !sessionName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username and session name are required' }),
    };
  }

  // Check if user has Spotify connected
  const [spotifyToken] = await sql`
    SELECT spotify_user_id FROM spotify_tokens 
    WHERE username = ${username} AND expires_at > NOW()
  `;

  if (!spotifyToken) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Spotify account not connected or expired' }),
    };
  }

  // Create new session
  const [newSession] = await sql`
    INSERT INTO jam_sessions (host_username, session_name)
    VALUES (${username}, ${sessionName})
    RETURNING *
  `;

  // Add host as participant
  await sql`
    INSERT INTO session_participants (session_id, username, spotify_user_id)
    VALUES (${newSession.id}, ${username}, ${spotifyToken.spotify_user_id})
  `;

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({ session: newSession }),
  };
}

// Update session (join/leave, playback state)
async function handleUpdateSession(event) {
  const { sessionId, action, username, trackData, position, isPlaying, volume } = JSON.parse(event.body || '{}');

  if (!sessionId || !action) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID and action are required' }),
    };
  }

  switch (action) {
    case 'join':
      return handleJoinSession(sessionId, username);
    case 'leave':
      return handleLeaveSession(sessionId, username);
    case 'updatePlayback':
      return handleUpdatePlayback(sessionId, username, { trackData, position, isPlaying, volume });
    default:
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action' }),
      };
  }
}

// Join session
async function handleJoinSession(sessionId, username) {
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  // Check if session exists and is active
  const [session] = await sql`
    SELECT id FROM jam_sessions WHERE id = ${sessionId} AND ended_at IS NULL
  `;

  if (!session) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Session not found or ended' }),
    };
  }

  // Check if user has Spotify connected
  const [spotifyToken] = await sql`
    SELECT spotify_user_id FROM spotify_tokens 
    WHERE username = ${username} AND expires_at > NOW()
  `;

  if (!spotifyToken) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Spotify account not connected or expired' }),
    };
  }

  // Add user to session (or update if already exists)
  await sql`
    INSERT INTO session_participants (session_id, username, spotify_user_id, last_seen)
    VALUES (${sessionId}, ${username}, ${spotifyToken.spotify_user_id}, NOW())
    ON CONFLICT (session_id, username) 
    DO UPDATE SET last_seen = NOW()
  `;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

// Leave session
async function handleLeaveSession(sessionId, username) {
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Username is required' }),
    };
  }

  await sql`
    DELETE FROM session_participants 
    WHERE session_id = ${sessionId} AND username = ${username}
  `;

  // Check if session is now empty and end it if host left
  const [session] = await sql`
    SELECT host_username FROM jam_sessions WHERE id = ${sessionId}
  `;

  if (session && session.host_username === username) {
    await sql`
      UPDATE jam_sessions 
      SET ended_at = NOW() 
      WHERE id = ${sessionId}
    `;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

// Update playback state
async function handleUpdatePlayback(sessionId, username, { trackData, position, isPlaying, volume }) {
  // Verify user is host or participant
  const [participant] = await sql`
    SELECT sp.username, js.host_username
    FROM session_participants sp
    JOIN jam_sessions js ON sp.session_id = js.id
    WHERE sp.session_id = ${sessionId} AND sp.username = ${username}
  `;

  if (!participant) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Not authorized to update this session' }),
    };
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (trackData) {
    updates.push('current_track_uri = $' + (values.length + 1));
    values.push(trackData.uri);
    updates.push('current_track_name = $' + (values.length + 1));
    values.push(trackData.name);
    updates.push('current_track_artist = $' + (values.length + 1));
    values.push(trackData.artist);
  }

  if (typeof position === 'number') {
    updates.push('current_position = $' + (values.length + 1));
    values.push(position);
  }

  if (typeof isPlaying === 'boolean') {
    updates.push('is_playing = $' + (values.length + 1));
    values.push(isPlaying);
  }

  if (typeof volume === 'number') {
    updates.push('volume = $' + (values.length + 1));
    values.push(Math.max(0, Math.min(100, volume)));
  }

  if (updates.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No valid updates provided' }),
    };
  }

  updates.push('last_updated = NOW()');
  values.push(sessionId);

  const query = `
    UPDATE jam_sessions 
    SET ${updates.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `;

  const [updatedSession] = await sql.unsafe(query, values);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ session: updatedSession }),
  };
}

// End session
async function handleEndSession(event) {
  const { sessionId, username } = JSON.parse(event.body || '{}');

  if (!sessionId || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID and username are required' }),
    };
  }

  // Verify user is host
  const [session] = await sql`
    SELECT host_username FROM jam_sessions 
    WHERE id = ${sessionId} AND host_username = ${username}
  `;

  if (!session) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Only the host can end the session' }),
    };
  }

  // End session
  await sql`
    UPDATE jam_sessions 
    SET ended_at = NOW() 
    WHERE id = ${sessionId}
  `;

  // Clean up participants
  await sql`
    DELETE FROM session_participants WHERE session_id = ${sessionId}
  `;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}
