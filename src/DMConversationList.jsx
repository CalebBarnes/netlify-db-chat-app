import React from 'react'
import Avatar from './Avatar'
import { useDMConversations } from './hooks/useDMConversations'

const DMConversationList = ({ username, onSelectConversation, selectedConversationId }) => {
  // Use React Query for conversations with automatic caching and background updates
  const {
    data: conversations = [],
    isLoading,
    error,
    refetch
  } = useDMConversations(username)

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  const truncateMessage = (message, maxLength = 40) => {
    if (!message) return 'No messages yet'
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
  }

  // Only show loading spinner on initial load, not on background refetches
  if (isLoading && conversations.length === 0) {
    return (
      <div className="dm-conversation-list loading">
        <div className="loading-spinner">Loading conversations...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dm-conversation-list error">
        <div className="error-message">{error.message || 'Failed to load conversations'}</div>
        <button onClick={() => refetch()} className="retry-button">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dm-conversation-list">
      <div className="dm-header">
        <h3>Direct Messages</h3>
        <button 
          className="new-dm-button"
          onClick={() => onSelectConversation('new')}
          title="Start new conversation"
        >
          ✉️
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="no-conversations">
          <p>No conversations yet</p>
          <button 
            className="start-dm-button"
            onClick={() => onSelectConversation('new')}
          >
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                selectedConversationId === conversation.id ? 'selected' : ''
              }`}
              onClick={() => onSelectConversation(conversation.id, conversation.other_username)}
            >
              <div className="conversation-avatar">
                <Avatar username={conversation.other_username} size={40} />
                {conversation.unread_count > 0 && (
                  <div className="unread-badge">{conversation.unread_count}</div>
                )}
              </div>
              
              <div className="conversation-info">
                <div className="conversation-header">
                  <span className="other-username">{conversation.other_username}</span>
                  <span className="last-message-time">
                    {formatLastMessageTime(conversation.last_message_at)}
                  </span>
                </div>
                
                <div className="last-message">
                  {conversation.last_sender && (
                    <span className="last-sender">
                      {conversation.last_sender === username ? 'You: ' : ''}
                    </span>
                  )}
                  <span className="last-message-text">
                    {truncateMessage(conversation.last_message)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DMConversationList
