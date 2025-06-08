import React, { useState, useEffect, useRef } from 'react'
import { Reply } from 'lucide-react'
import Avatar from './Avatar'

const DMChat = ({ 
  username, 
  conversationId, 
  otherUsername, 
  onBack,
  soundSettings,
  playMessageSound 
}) => {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [lastMessageId, setLastMessageId] = useState(null)
  
  const messagesEndRef = useRef(null)
  const lastMessageIdRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch initial messages
  const fetchMessages = async () => {
    if (!conversationId || !username) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(
        `/.netlify/functions/direct-messages?conversationId=${conversationId}&username=${encodeURIComponent(username)}`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setMessages(data)
      
      if (data.length > 0) {
        const latestMessage = data[data.length - 1]
        setLastMessageId(latestMessage.id)
        lastMessageIdRef.current = latestMessage.id
        
        // Mark messages as read
        markAsRead(latestMessage.id)
      }
    } catch (err) {
      console.error('Error fetching DM messages:', err)
      setError('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  // Fetch new messages for real-time updates
  const fetchNewMessages = async () => {
    if (!conversationId || !username || !lastMessageIdRef.current) return

    try {
      const response = await fetch(
        `/.netlify/functions/direct-messages?conversationId=${conversationId}&username=${encodeURIComponent(username)}&sinceId=${lastMessageIdRef.current}`
      )
      
      if (!response.ok) return
      
      const newMessages = await response.json()
      
      if (newMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id))
          const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))
          
          if (trulyNewMessages.length > 0) {
            // Play sound for new messages from other user
            trulyNewMessages.forEach(message => {
              if (message.sender_username !== username && soundSettings?.enabled && soundSettings?.messageSounds) {
                playMessageSound?.(false)
              }
            })
            
            // Update last message ID
            const latestMessage = trulyNewMessages[trulyNewMessages.length - 1]
            setLastMessageId(latestMessage.id)
            lastMessageIdRef.current = latestMessage.id
            
            // Mark as read
            markAsRead(latestMessage.id)
            
            return [...prev, ...trulyNewMessages]
          }
          
          return prev
        })
      }
    } catch (err) {
      console.error('Error fetching new DM messages:', err)
    }
  }

  // Mark messages as read
  const markAsRead = async (messageId) => {
    if (!conversationId || !username || !messageId) return

    try {
      await fetch('/.netlify/functions/dm-read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          conversationId: parseInt(conversationId),
          lastReadMessageId: messageId
        }),
      })
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }

  // Send a new message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim() || submitting) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/.netlify/functions/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          message: newMessage.trim(),
          conversationId: parseInt(conversationId),
          replyToId: replyingTo?.id || null,
          replyToUsername: replyingTo?.sender_username || null,
          replyPreview: replyingTo?.message || null
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const sentMessage = await response.json()
      
      // Add message to local state immediately
      setMessages(prev => [...prev, sentMessage])
      setNewMessage('')
      setReplyingTo(null)
      
      // Update last message ID
      setLastMessageId(sentMessage.id)
      lastMessageIdRef.current = sentMessage.id
      
      // Play send sound
      if (soundSettings?.enabled && soundSettings?.messageSounds) {
        playMessageSound?.(true)
      }
      
    } catch (err) {
      console.error('Error sending DM:', err)
      setError('Failed to send message')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle reply
  const handleReply = (message) => {
    setReplyingTo(message)
  }

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null)
  }

  // Fetch initial messages on mount
  useEffect(() => {
    fetchMessages()
  }, [conversationId, username])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Set up real-time polling
  useEffect(() => {
    if (!conversationId || !username) return

    const interval = setInterval(() => {
      fetchNewMessages()
    }, 1000) // Poll every second for real-time feel

    return () => clearInterval(interval)
  }, [conversationId, username])

  if (loading) {
    return (
      <div className="dm-chat loading">
        <div className="dm-header">
          <button onClick={onBack} className="back-button">←</button>
          <span>Loading...</span>
        </div>
        <div className="loading-spinner">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="dm-chat">
      <div className="dm-header">
        <button onClick={onBack} className="back-button">←</button>
        <div className="dm-header-info">
          <Avatar username={otherUsername} size={32} />
          <span className="other-username">{otherUsername}</span>
        </div>
      </div>

      <div className="messages-list">
        {error && (
          <div className="error-message">{error}</div>
        )}

        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>💬 Start a conversation</h3>
            <p>Send a message to {otherUsername} to begin your conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-message-id={message.id}
              className={`message ${message.sender_username === username ? 'own-message' : ''}`}
            >
              {/* Show compact reply reference if this is a reply - Discord style */}
              {message.reply_to_id && (
                <div className="reply-reference">
                  <span className="reply-to">↳ {message.reply_to_username}: </span>
                  <span className="reply-preview">{message.reply_preview}</span>
                </div>
              )}

              <div className="message-header">
                <Avatar
                  username={message.sender_username}
                  size={24}
                  className="message-avatar"
                />
                <span className="message-username">{message.sender_username}</span>
                <span className="message-time">
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <button
                  className="reply-btn"
                  onClick={() => handleReply(message)}
                  title={`Reply to ${message.sender_username}`}
                  aria-label={`Reply to ${message.sender_username}'s message`}
                >
                  <Reply size={14} />
                </button>
              </div>
              <div className="message-content">
                {message.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        {replyingTo && (
          <div className="reply-indicator">
            <span>Replying to {replyingTo.sender_username}: {replyingTo.message.substring(0, 50)}...</span>
            <button onClick={cancelReply} className="cancel-reply">✕</button>
          </div>
        )}

        <div className="input-group">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${otherUsername}... (Shift+Enter for line breaks)`}
            disabled={submitting}
            className="message-input"
            maxLength={1000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            rows={1}
            style={{ resize: 'none', overflow: 'hidden' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || submitting}
            className="send-btn"
            aria-label={submitting ? 'Sending message...' : 'Send message'}
            title={submitting ? 'Sending...' : 'Send'}
          >
            {submitting ? '...' : '→'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default DMChat
