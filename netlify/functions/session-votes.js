import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
        return handleGetVotes(event);
      case 'POST':
        return handleCastVote(event);
      case 'DELETE':
        return handleRemoveVote(event);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Session votes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Get current votes for a session
async function handleGetVotes(event) {
  const { sessionId, voteType } = event.queryStringParameters || {};

  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID is required' }),
    };
  }

  let whereClause = 'WHERE session_id = $1 AND (expires_at IS NULL OR expires_at > NOW())';
  let params = [sessionId];

  if (voteType) {
    whereClause += ' AND vote_type = $2';
    params.push(voteType);
  }

  const votes = await sql.unsafe(`
    SELECT vote_type, vote_target, 
           COUNT(*) as vote_count,
           SUM(vote_value) as total_value,
           array_agg(username) as voters,
           MIN(created_at) as started_at,
           MAX(expires_at) as expires_at
    FROM session_votes 
    ${whereClause}
    GROUP BY vote_type, vote_target
    ORDER BY vote_type, total_value DESC
  `, params);

  // Get participant count for calculating majorities
  const [participantCount] = await sql`
    SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${sessionId}
  `;

  const majorityThreshold = Math.ceil(participantCount.count / 2);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      votes,
      participantCount: participantCount.count,
      majorityThreshold,
    }),
  };
}

// Cast a vote
async function handleCastVote(event) {
  const { sessionId, voteType, voteTarget, username, voteValue = 1, expiresIn = 30 } = JSON.parse(event.body || '{}');

  if (!sessionId || !voteType || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID, vote type, and username are required' }),
    };
  }

  // Verify user is in the session
  const [participant] = await sql`
    SELECT username FROM session_participants 
    WHERE session_id = ${sessionId} AND username = ${username}
  `;

  if (!participant) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'You must be in the session to vote' }),
    };
  }

  // Set expiration time for time-sensitive votes
  let expiresAt = null;
  if (['skip', 'vibe'].includes(voteType)) {
    expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  // Cast vote (upsert to allow changing votes)
  await sql`
    INSERT INTO session_votes (session_id, vote_type, vote_target, username, vote_value, expires_at)
    VALUES (${sessionId}, ${voteType}, ${voteTarget || ''}, ${username}, ${voteValue}, ${expiresAt})
    ON CONFLICT (session_id, vote_type, vote_target, username)
    DO UPDATE SET 
      vote_value = EXCLUDED.vote_value,
      created_at = NOW(),
      expires_at = EXCLUDED.expires_at
  `;

  // Check if vote passed (for skip votes)
  if (voteType === 'skip') {
    const result = await checkSkipVote(sessionId, voteTarget);
    if (result.passed) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          votePassed: true,
          action: 'skip_track',
          voteCount: result.voteCount,
          required: result.required,
        }),
      };
    }
  }

  // Check if vibe vote completed
  if (voteType === 'vibe') {
    const result = await checkVibeVote(sessionId);
    if (result.winner) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          votePassed: true,
          action: 'change_vibe',
          winner: result.winner,
          votes: result.votes,
        }),
      };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

// Remove a vote
async function handleRemoveVote(event) {
  const { sessionId, voteType, voteTarget, username } = JSON.parse(event.body || '{}');

  if (!sessionId || !voteType || !username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Session ID, vote type, and username are required' }),
    };
  }

  await sql`
    DELETE FROM session_votes 
    WHERE session_id = ${sessionId} 
      AND vote_type = ${voteType} 
      AND vote_target = ${voteTarget || ''}
      AND username = ${username}
  `;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

// Check if skip vote passed
async function checkSkipVote(sessionId, trackUri) {
  const [participantCount] = await sql`
    SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${sessionId}
  `;

  const [voteCount] = await sql`
    SELECT COUNT(*) as count FROM session_votes 
    WHERE session_id = ${sessionId} 
      AND vote_type = 'skip' 
      AND vote_target = ${trackUri || ''}
      AND vote_value > 0
      AND (expires_at IS NULL OR expires_at > NOW())
  `;

  const required = Math.ceil(participantCount.count / 2);
  const passed = voteCount.count >= required;

  if (passed) {
    // Clean up skip votes for this track
    await sql`
      DELETE FROM session_votes 
      WHERE session_id = ${sessionId} 
        AND vote_type = 'skip' 
        AND vote_target = ${trackUri || ''}
    `;
  }

  return {
    passed,
    voteCount: voteCount.count,
    required,
  };
}

// Check vibe vote results
async function checkVibeVote(sessionId) {
  const votes = await sql`
    SELECT vote_target, COUNT(*) as vote_count
    FROM session_votes 
    WHERE session_id = ${sessionId} 
      AND vote_type = 'vibe'
      AND (expires_at IS NULL OR expires_at > NOW())
    GROUP BY vote_target
    ORDER BY vote_count DESC
  `;

  if (votes.length === 0) {
    return { winner: null, votes: [] };
  }

  // Check if voting period should end (e.g., after 30 seconds or when all participants voted)
  const [participantCount] = await sql`
    SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${sessionId}
  `;

  const totalVotes = votes.reduce((sum, vote) => sum + parseInt(vote.vote_count), 0);
  const allVoted = totalVotes >= participantCount.count;

  // Check if oldest vote is expired (voting period ended)
  const [oldestVote] = await sql`
    SELECT expires_at FROM session_votes 
    WHERE session_id = ${sessionId} AND vote_type = 'vibe'
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const votingEnded = oldestVote && oldestVote.expires_at && new Date() > new Date(oldestVote.expires_at);

  if (allVoted || votingEnded) {
    const winner = votes[0];
    
    // Clean up vibe votes
    await sql`
      DELETE FROM session_votes 
      WHERE session_id = ${sessionId} AND vote_type = 'vibe'
    `;

    return {
      winner: winner.vote_target,
      votes: votes.map(v => ({ vibe: v.vote_target, count: parseInt(v.vote_count) })),
    };
  }

  return { winner: null, votes };
}

// Clean up expired votes (called periodically)
export async function cleanupExpiredVotes() {
  await sql`
    DELETE FROM session_votes 
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
  `;
}
