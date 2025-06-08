import React, { useState, useEffect } from 'react'
import Avatar from './Avatar'

const NewDMDialog = ({ username, onStartConversation, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch available users to start conversations with
  const fetchAvailableUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get all chat participants
      const response = await fetch('/.netlify/functions/participants')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const participants = data.participants

      // Filter out current user and AI assistants
      const filteredUsers = participants.filter(user =>
        user.username !== username &&
        user.username !== 'Lumi' &&
        user.username !== 'System'
      )
      
      setAvailableUsers(filteredUsers)
    } catch (err) {
      console.error('Error fetching available users:', err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableUsers()
  }, [username])

  // Filter users based on search term
  const filteredUsers = availableUsers.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleStartConversation = (targetUsername) => {
    onStartConversation(targetUsername)
  }

  const getStatusIndicator = (user) => {
    switch (user.status) {
      case 'online':
        return '🟢'
      case 'recently_active':
        return '🟡'
      default:
        return '⚫'
    }
  }

  const getStatusText = (user) => {
    switch (user.status) {
      case 'online':
        return 'Online'
      case 'recently_active':
        return 'Recently active'
      default:
        return 'Offline'
    }
  }

  return (
    <div className="new-dm-dialog-overlay">
      <div className="new-dm-dialog">
        <div className="dialog-header">
          <h3>Start a conversation</h3>
          <button onClick={onCancel} className="close-button">✕</button>
        </div>

        <div className="dialog-content">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="user-search-input"
              autoFocus
            />
          </div>

          {loading ? (
            <div className="loading-section">
              <div className="loading-spinner">Loading users...</div>
            </div>
          ) : error ? (
            <div className="error-section">
              <div className="error-message">{error}</div>
              <button onClick={fetchAvailableUsers} className="retry-button">
                Retry
              </button>
            </div>
          ) : (
            <div className="users-section">
              {filteredUsers.length === 0 ? (
                <div className="no-users">
                  {searchTerm ? (
                    <p>No users found matching "{searchTerm}"</p>
                  ) : (
                    <p>No other users available</p>
                  )}
                </div>
              ) : (
                <div className="users-list">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.username}
                      className="user-item"
                      onClick={() => handleStartConversation(user.username)}
                    >
                      <div className="user-avatar">
                        <Avatar username={user.username} size={40} />
                        <div className="status-indicator">
                          {getStatusIndicator(user)}
                        </div>
                      </div>
                      
                      <div className="user-info">
                        <div className="user-header">
                          <span className="username">{user.username}</span>
                          <span className="status-text">
                            {getStatusText(user)}
                          </span>
                        </div>
                        
                        <div className="user-stats">
                          <span className="message-count">
                            {user.message_count} messages
                          </span>
                          {user.last_message_at && (
                            <span className="last-active">
                              Last active: {new Date(user.last_message_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewDMDialog
