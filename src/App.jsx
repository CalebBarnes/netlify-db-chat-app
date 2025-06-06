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
  const messagesEndRef = useRef(null)
  const lastMessageTimeRef = useRef(null)
  const lastMessageIdRef = useRef(null)

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
      }, 5000) // Update presence every 5 seconds

      // Initial presence update and user fetch
      updatePresence()
      fetchOnlineUsers()

      return () => {
        clearInterval(messageInterval)
        clearInterval(presenceInterval)
        // Remove user from presence when component unmounts
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
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
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
            >
              {showSidebar ? '👥' : '👥'}
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
          <div className="sidebar">
            <div className="sidebar-header">
              <h3>👥 Online Users</h3>
              <span className="user-count-badge">{onlineUsers.length}</span>
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
        )}
      </div>

      <form className="message-form" onSubmit={sendMessage}>
        <div className="input-group">
          <input
            type="text"
            className="message-input"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
