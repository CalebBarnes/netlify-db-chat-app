import { useState, useEffect } from 'react';

export default function SpotifyAuth({ username, onAuthChange }) {
  const [isConnected, setIsConnected] = useState(false);
  const [spotifyUserId, setSpotifyUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, [username]);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/spotify-auth/status?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      if (response.ok) {
        setIsConnected(data.connected);
        setSpotifyUserId(data.spotifyUserId);
        onAuthChange?.(data.connected, data.spotifyUserId);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to check Spotify connection');
      console.error('Spotify status check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/spotify-auth/login?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      if (response.ok) {
        // Open Spotify auth in popup
        const popup = window.open(
          data.authUrl,
          'spotify-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Poll for popup closure
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Check if auth was successful
            setTimeout(() => {
              checkConnectionStatus();
            }, 1000);
          }
        }, 1000);

        // Close popup after 5 minutes if still open
        setTimeout(() => {
          if (!popup.closed) {
            popup.close();
            clearInterval(checkClosed);
            setError('Authentication timed out');
          }
        }, 5 * 60 * 1000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to start Spotify authentication');
      console.error('Spotify auth error:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      const response = await fetch('/api/spotify-auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        setIsConnected(false);
        setSpotifyUserId(null);
        onAuthChange?.(false, null);
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to disconnect Spotify');
      console.error('Spotify disconnect error:', err);
    }
  };

  const handleRefresh = async () => {
    try {
      setError(null);
      const response = await fetch('/api/spotify-auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        checkConnectionStatus();
      } else {
        const data = await response.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to refresh Spotify connection');
      console.error('Spotify refresh error:', err);
    }
  };

  if (loading) {
    return (
      <div className="spotify-auth loading">
        <div className="spotify-status">
          <span className="spotify-icon">🎵</span>
          <span>Checking Spotify connection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-auth">
      {error && (
        <div className="spotify-error">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="spotify-status">
        <span className="spotify-icon">🎵</span>
        {isConnected ? (
          <div className="spotify-connected">
            <div className="connection-info">
              <span className="status-text">✅ Spotify Connected</span>
              {spotifyUserId && (
                <span className="user-id">({spotifyUserId})</span>
              )}
            </div>
            <div className="spotify-actions">
              <button 
                onClick={handleRefresh}
                className="spotify-btn refresh-btn"
                title="Refresh connection"
              >
                🔄
              </button>
              <button 
                onClick={handleDisconnect}
                className="spotify-btn disconnect-btn"
                title="Disconnect Spotify"
              >
                🔌
              </button>
            </div>
          </div>
        ) : (
          <div className="spotify-disconnected">
            <span className="status-text">🎵 Connect Spotify to join jam sessions</span>
            <button 
              onClick={handleConnect}
              className="spotify-btn connect-btn"
            >
              Connect Spotify
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="spotify-features">
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">🎧</span>
              <span>Join synchronized jam sessions</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🗳️</span>
              <span>Vote to skip songs and change vibes</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📝</span>
              <span>Add songs to collaborative queue</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CSS styles for Spotify auth component
export const spotifyAuthStyles = `
.spotify-auth {
  background: var(--message-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
}

.spotify-auth.loading {
  opacity: 0.7;
}

.spotify-error {
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #c33;
  font-size: 14px;
}

.error-close {
  background: none;
  border: none;
  color: #c33;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  margin-left: 8px;
}

.spotify-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spotify-icon {
  font-size: 20px;
}

.spotify-connected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-weight: 500;
  color: var(--text-color);
}

.user-id {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.spotify-actions {
  display: flex;
  gap: 8px;
}

.spotify-disconnected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.spotify-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.spotify-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.connect-btn {
  background: #1db954;
  padding: 8px 16px;
  font-weight: 500;
}

.connect-btn:hover {
  background: #1ed760;
}

.refresh-btn {
  background: var(--accent-color);
  padding: 4px 8px;
  font-size: 12px;
}

.disconnect-btn {
  background: #dc3545;
  padding: 4px 8px;
  font-size: 12px;
}

.disconnect-btn:hover {
  background: #c82333;
}

.spotify-features {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.feature-icon {
  font-size: 14px;
}

@media (max-width: 768px) {
  .spotify-connected,
  .spotify-disconnected {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .spotify-actions {
    align-self: flex-end;
  }
}
`;
