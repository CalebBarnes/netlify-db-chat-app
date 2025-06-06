import { useState, useEffect, useRef } from 'react'

function App() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [username, setUsername] = useState('')
  const [isUsernameSet, setIsUsernameSet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState(null)
  const [lastMessageId, setLastMessageId] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [showSidebar, setShowSidebar] = useState(true)
  const [typingUsers, setTypingUsers] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const lastMessageTimeRef = useRef(null)
  const lastMessageIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch initial messages on component mount
  useEffect(() => {
    fetchMessages()
  }, [])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Set up real-time polling when username is set
  useEffect(() => {
    if (isUsernameSet) {
      const messageInterval = setInterval(() => {
        fetchNewMessages()
      }, 1000) // Poll every 1 second for better real-time feel

      const presenceInterval = setInterval(() => {
        updatePresence()
        fetchOnlineUsers()
      }, 2000) // Update presence every 2 seconds for real-time typing indicators

      // Initial presence update and user fetch
      updatePresence()
      fetchOnlineUsers()

      return () => {
        clearInterval(messageInterval)
        clearInterval(presenceInterval)
        // Clear typing timeout and remove user from presence when component unmounts
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        handleTypingStop()
        removePresence()
      }
    }
  }, [isUsernameSet]) // Only depend on isUsernameSet

  // Cleanup presence when page is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isUsernameSet) {
        // Use sendBeacon for reliable cleanup on page close
        navigator.sendBeacon('/api/presence', JSON.stringify({ username }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isUsernameSet, username])

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showSidebar) {
        setShowSidebar(false)
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showSidebar])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/messages')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setMessages(data)
      if (data.length > 0) {
        const latestMessage = data[data.length - 1]
        setLastMessageTime(latestMessage.created_at)
        setLastMessageId(latestMessage.id)
        lastMessageTimeRef.current = latestMessage.created_at
        lastMessageIdRef.current = latestMessage.id
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('Failed to load messages. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchNewMessages = async () => {
    if (!lastMessageIdRef.current) return

    try {
      // Only get messages with ID greater than the last known message ID
      const response = await fetch(`/api/messages?sinceId=${lastMessageIdRef.current}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const newMessages = await response.json()

      if (newMessages.length > 0) {
        // Use functional update to avoid stale closures and ensure proper deduplication
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id))
          const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))

          if (trulyNewMessages.length > 0) {
            // Update refs with the latest message info
            const latestMessage = trulyNewMessages[trulyNewMessages.length - 1]
            lastMessageTimeRef.current = latestMessage.created_at
            lastMessageIdRef.current = latestMessage.id

            // Also update state for consistency
            setLastMessageTime(latestMessage.created_at)
            setLastMessageId(latestMessage.id)

            return [...prev, ...trulyNewMessages]
          }
          return prev
        })
      }
    } catch (err) {
      console.error('Error fetching new messages:', err)
      // Don't show error for polling failures to avoid spam
    }
  }

  const updatePresence = async () => {
    if (!username.trim()) return

    try {
      await fetch('/api/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      })
    } catch (err) {
      console.error('Error updating presence:', err)
    }
  }

  const removePresence = async () => {
    if (!username.trim()) return

    try {
      await fetch('/api/presence', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      })
    } catch (err) {
      console.error('Error removing presence:', err)
    }
  }

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch('/api/presence')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const users = await response.json()
      setOnlineUsers(users)

      // Extract typing users (excluding current user)
      const currentlyTyping = users
        .filter(user => user.is_typing && user.username !== username.trim())
        .map(user => user.username)
      setTypingUsers(currentlyTyping)
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  const updateTypingStatus = async (typing) => {
    if (!username.trim()) return

    try {
      await fetch('/api/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          isTyping: typing
        }),
      })
    } catch (err) {
      console.error('Error updating typing status:', err)
    }
  }

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true)
      updateTypingStatus(true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      updateTypingStatus(false)
    }, 3000)
  }

  const handleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    setIsTyping(false)
    updateTypingStatus(false)
  }

  const handleUsernameSubmit = (e) => {
    e.preventDefault()
    if (!username.trim()) return

    setIsUsernameSet(true)
    setError(null)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      setSubmitting(true)
      setError(null)

      // Stop typing indicator when sending message
      handleTypingStop()

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          message: newMessage.trim()
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const message = await response.json()
      setMessages(prev => [...prev, message])
      setLastMessageTime(message.created_at)
      setLastMessageId(message.id)
      lastMessageTimeRef.current = message.created_at
      lastMessageIdRef.current = message.id
      setNewMessage('')
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMessageInputChange = (e) => {
    setNewMessage(e.target.value)

    // Trigger typing indicator when user starts typing
    if (e.target.value.trim().length > 0) {
      handleTypingStart()
    } else if (isTyping) {
      handleTypingStop()
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">Loading chat...</div>
      </div>
    )
  }

  if (!isUsernameSet) {
    return (
      <div className="app">
        <div className="header">
          <h1>💬 Chat App</h1>
          <p>Powered by Netlify DB</p>
        </div>

        <form className="username-form" onSubmit={handleUsernameSubmit}>
          <div className="input-group">
            <input
              type="text"
              className="username-input"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <button
              type="submit"
              className="join-btn"
              disabled={!username.trim()}
            >
              Join Chat
            </button>
          </div>
        </form>

        {error && (
          <div className="error">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>💬 Chat App</h1>
            <p>Welcome, <strong>{username}</strong>!</p>
          </div>
          <div className="header-right">
            <div className="user-count">
              👥 {onlineUsers.length} online
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? 'Close online users panel' : 'Open online users panel'}
              aria-expanded={showSidebar}
            >
              👥
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="chat-container">
        <div className="messages-container">
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>No messages yet!</h3>
                <p>Be the first to say hello! 👋</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`message ${message.username === username ? 'own-message' : ''}`}
                >
                  <div className="message-header">
                    <span className="message-username">{message.username}</span>
                    <span className="message-time">{formatTime(message.created_at)}</span>
                  </div>
                  <div className="message-content">
                    {message.message}
                  </div>
                </div>
              ))
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {showSidebar && (
          <>
            {/* Mobile backdrop overlay */}
            <div
              className="sidebar-backdrop"
              onClick={() => setShowSidebar(false)}
              aria-hidden="true"
            />
            <div className="sidebar">
              <div className="sidebar-header">
                <h3>👥 Online Users</h3>
                <div className="sidebar-header-actions">
                  <span className="user-count-badge">{onlineUsers.length}</span>
                  <button
                    className="sidebar-close-btn"
                    onClick={() => setShowSidebar(false)}
                    aria-label="Close online users panel"
                  >
                    ✕
                  </button>
                </div>
              </div>
            <div className="online-users-list">
              {onlineUsers.length === 0 ? (
                <div className="no-users">
                  <p>No users online</p>
                </div>
              ) : (
                onlineUsers.map(user => (
                  <div
                    key={user.username}
                    className={`online-user ${user.username === username ? 'current-user' : ''}`}
                  >
                    <div className="user-status">
                      <span className="status-dot"></span>
                      <span className="username">{user.username}</span>
                    </div>
                    {user.username === username && (
                      <span className="you-label">(you)</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          </>
        )}
      </div>

      <form className="message-form" onSubmit={sendMessage}>
        {/* Typing indicators - integrated into input container */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator-inline" aria-live="polite" role="status">
            <div className="typing-content">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="typing-text">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                  : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
                }
              </span>
            </div>
          </div>
        )}

        <div className="input-group">
          <input
            type="text"
            className="message-input"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleMessageInputChange}
            disabled={submitting}
            maxLength={1000}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={submitting || !newMessage.trim()}
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
