import { useState, useEffect, useRef } from 'react';

export default function JamSession({ username, isSpotifyConnected, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [votes, setVotes] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const pollInterval = useRef(null);

  useEffect(() => {
    if (isSpotifyConnected) {
      loadSessions();
      startPolling();
    }
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [isSpotifyConnected]);

  const startPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
    
    pollInterval.current = setInterval(() => {
      if (currentSession) {
        loadSessionDetails(currentSession.id);
        loadVotes(currentSession.id);
      } else {
        loadSessions();
      }
    }, 2000);
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/jam-sessions');
      const data = await response.json();
      
      if (response.ok) {
        setSessions(data.sessions);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load jam sessions');
      console.error('Load sessions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId) => {
    try {
      const response = await fetch(`/api/jam-sessions?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        setCurrentSession(data.session);
        setParticipantCount(data.session.participants.length);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Load session details error:', err);
    }
  };

  const loadVotes = async (sessionId) => {
    try {
      const response = await fetch(`/api/session-votes?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        setVotes(data.votes);
      }
    } catch (err) {
      console.error('Load votes error:', err);
    }
  };

  const createSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      setError(null);
      const response = await fetch('/api/jam-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          sessionName: newSessionName.trim(),
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setCurrentSession(data.session);
        setShowCreateForm(false);
        setNewSessionName('');
        loadSessionDetails(data.session.id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to create session');
      console.error('Create session error:', err);
    }
  };

  const joinSession = async (sessionId) => {
    try {
      setError(null);
      const response = await fetch('/api/jam-sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'join',
          username,
        }),
      });

      if (response.ok) {
        loadSessionDetails(sessionId);
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to join session');
      console.error('Join session error:', err);
    }
  };

  const leaveSession = async () => {
    if (!currentSession) return;

    try {
      setError(null);
      const response = await fetch('/api/jam-sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          action: 'leave',
          username,
        }),
      });

      if (response.ok) {
        setCurrentSession(null);
        loadSessions();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to leave session');
      console.error('Leave session error:', err);
    }
  };

  const searchTracks = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`/api/spotify-control/search?username=${encodeURIComponent(username)}&query=${encodeURIComponent(searchQuery)}&type=track&limit=10`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.tracks?.items || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to search tracks');
      console.error('Search tracks error:', err);
    }
  };

  const addToQueue = async (track) => {
    if (!currentSession) return;

    try {
      setError(null);
      const response = await fetch('/api/spotify-control/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          sessionId: currentSession.id,
          trackUri: track.uri,
        }),
      });

      if (response.ok) {
        setSearchResults([]);
        setSearchQuery('');
        loadSessionDetails(currentSession.id);
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add track to queue');
      console.error('Add to queue error:', err);
    }
  };

  const voteSkip = async () => {
    if (!currentSession?.current_track_uri) return;

    try {
      setError(null);
      const response = await fetch('/api/session-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          voteType: 'skip',
          voteTarget: currentSession.current_track_uri,
          username,
          expiresIn: 30,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.votePassed) {
          // Skip the track
          await fetch('/api/spotify-control/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              sessionId: currentSession.id,
            }),
          });
        }
        loadVotes(currentSession.id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to vote skip');
      console.error('Vote skip error:', err);
    }
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isSpotifyConnected) {
    return (
      <div className="jam-session-overlay">
        <div className="jam-session-modal">
          <div className="modal-header">
            <h2>🎵 Jam Sessions</h2>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
          <div className="modal-content">
            <div className="spotify-required">
              <span className="spotify-icon">🎵</span>
              <h3>Spotify Required</h3>
              <p>Connect your Spotify account to join jam sessions and enjoy synchronized music with friends!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jam-session-overlay">
      <div className="jam-session-modal">
        <div className="modal-header">
          <h2>🎵 Jam Sessions</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="modal-content">
          {currentSession ? (
            <div className="current-session">
              <div className="session-header">
                <h3>{currentSession.session_name}</h3>
                <div className="session-actions">
                  <span className="participant-count">👥 {participantCount}</span>
                  <button onClick={leaveSession} className="leave-btn">Leave</button>
                </div>
              </div>

              {currentSession.current_track_name && (
                <div className="now-playing">
                  <h4>🎧 Now Playing</h4>
                  <div className="track-info">
                    <div className="track-details">
                      <span className="track-name">{currentSession.current_track_name}</span>
                      <span className="track-artist">{currentSession.current_track_artist}</span>
                    </div>
                    <div className="playback-controls">
                      <span className="track-time">{formatTime(currentSession.current_position || 0)}</span>
                      <button onClick={voteSkip} className="vote-skip-btn">
                        ⏭️ Vote Skip
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {votes.length > 0 && (
                <div className="active-votes">
                  <h4>🗳️ Active Votes</h4>
                  {votes.map((vote, index) => (
                    <div key={index} className="vote-item">
                      <span className="vote-type">{vote.vote_type}</span>
                      <span className="vote-count">{vote.vote_count}/{Math.ceil(participantCount / 2)} needed</span>
                      <div className="vote-progress">
                        <div 
                          className="vote-bar" 
                          style={{ width: `${(vote.vote_count / Math.ceil(participantCount / 2)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="add-music">
                <h4>🔍 Add Music</h4>
                <div className="search-form">
                  <input
                    type="text"
                    placeholder="Search for songs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchTracks()}
                  />
                  <button onClick={searchTracks}>Search</button>
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((track) => (
                      <div key={track.id} className="track-result">
                        <div className="track-info">
                          <span className="track-name">{track.name}</span>
                          <span className="track-artist">{track.artists[0].name}</span>
                        </div>
                        <button onClick={() => addToQueue(track)} className="add-btn">
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {currentSession.queue && currentSession.queue.length > 0 && (
                <div className="session-queue">
                  <h4>📝 Queue</h4>
                  {currentSession.queue.map((item, index) => (
                    <div key={item.id} className="queue-item">
                      <span className="queue-position">{index + 1}.</span>
                      <div className="track-info">
                        <span className="track-name">{item.track_name}</span>
                        <span className="track-artist">{item.track_artist}</span>
                      </div>
                      <span className="added-by">by {item.added_by}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="session-list">
              <div className="list-header">
                <h3>Active Sessions</h3>
                <button 
                  onClick={() => setShowCreateForm(true)} 
                  className="create-btn"
                >
                  + Create Session
                </button>
              </div>

              {showCreateForm && (
                <div className="create-form">
                  <input
                    type="text"
                    placeholder="Session name..."
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createSession()}
                    autoFocus
                  />
                  <div className="form-actions">
                    <button onClick={createSession} disabled={!newSessionName.trim()}>
                      Create
                    </button>
                    <button onClick={() => setShowCreateForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="loading">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🎵</span>
                  <p>No active jam sessions</p>
                  <p>Create one to start listening together!</p>
                </div>
              ) : (
                <div className="sessions">
                  {sessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-info">
                        <h4>{session.session_name}</h4>
                        <span className="host">Host: {session.host_username}</span>
                        <span className="participants">👥 {session.participant_count}</span>
                      </div>
                      <button 
                        onClick={() => joinSession(session.id)}
                        className="join-btn"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
