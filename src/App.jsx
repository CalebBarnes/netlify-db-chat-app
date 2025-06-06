import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ThemeToggle from './ThemeToggle'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true, // Enable GitHub Flavored Markdown
  sanitize: false, // We'll handle sanitization manually
  smartLists: true,
  smartypants: false
})

// Detect @mentions in message text
const detectMentions = (message) => {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g
  const matches = message.match(mentionRegex) || []
  return matches.map(match => match.substring(1)) // Remove @ symbol
}

// Check if current user is mentioned
const isUserMentioned = (mentions, currentUser) => {
  return mentions.some(mention =>
    mention.toLowerCase() === currentUser.toLowerCase()
  )
}

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

// Show notification for mention
const showMentionNotification = (sender, message) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(`${sender} mentioned you`, {
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/favicon.ico',
      tag: 'chat-mention',
      requireInteraction: false // Less intrusive - auto-closes after 5 seconds
    })

    // Auto-close notification after 5 seconds
    setTimeout(() => {
      notification.close()
    }, 5000)

    // Focus window when notification is clicked
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }
}

// Escape special regex characters in username
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Secure markdown renderer with DOMPurify sanitization and mention highlighting
const renderMarkdown = (text, currentUser = '') => {
  if (!text) return ''

  try {
    // First highlight @mentions before markdown processing
    let processedText = text
    if (currentUser) {
      // Escape special regex characters in username for safe regex construction
      const escapedUser = escapeRegex(currentUser)

      // Highlight mentions of the current user
      const mentionRegex = new RegExp(`@(${escapedUser})\\b`, 'gi')
      processedText = processedText.replace(mentionRegex, '<mark class="mention-highlight">@$1</mark>')

      // Highlight other mentions with a different style
      const otherMentionRegex = /@([a-zA-Z0-9_-]+)/g
      processedText = processedText.replace(otherMentionRegex, (match, username) => {
        if (username.toLowerCase() === currentUser.toLowerCase()) {
          return match // Already highlighted above
        }
        return `<span class="mention">@${username}</span>`
      })
    }

    // Then convert markdown to HTML
    const html = marked(processedText)

    // Then sanitize the HTML with DOMPurify for comprehensive XSS protection
    return DOMPurify.sanitize(html, {
      // Allow common HTML elements for markdown + mention highlighting
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'mark', 'span'
      ],
      ALLOWED_ATTR: ['href', 'title', 'class'],
      // Ensure links are safe
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false
    })
  } catch (error) {
    console.warn('Markdown parsing error:', error)
    return DOMPurify.sanitize(text) // Fallback to sanitized plain text
  }
}

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
  // Initialize sidebar state based on screen size - closed on mobile, open on desktop
  const [showSidebar, setShowSidebar] = useState(() => {
    // Check if we're on mobile (screen width < 768px)
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768
    }
    return false // Default to closed if window is not available (SSR)
  })
  const [typingUsers, setTypingUsers] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState('default')

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState(null) // { id, username, message }
  const messagesEndRef = useRef(null)
  const messageInputRef = useRef(null)
  const lastMessageTimeRef = useRef(null)
  const lastMessageIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load saved username from localStorage on app startup
  useEffect(() => {
    try {
      const savedUsername = localStorage.getItem('chatapp-username')
      if (savedUsername?.trim()) {
        setUsername(savedUsername.trim())
        setIsUsernameSet(true)
      }
    } catch (error) {
      console.warn('Failed to load saved username from localStorage:', error)
    }
  }, [])

  // Request notification permission when user joins chat
  useEffect(() => {
    if (isUsernameSet) {
      // Check if user previously dismissed the notification banner
      try {
        const dismissed = localStorage.getItem('chatapp-notification-dismissed')
        if (dismissed === 'true') {
          setNotificationPermission('dismissed')
          return
        }
      } catch (error) {
        console.warn('Failed to load notification preference:', error)
      }

      // Check current permission status
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission)

        // Request permission if not already granted or denied
        if (Notification.permission === 'default') {
          requestNotificationPermission().then(granted => {
            setNotificationPermission(granted ? 'granted' : 'denied')
          })
        }
      }
    }
  }, [isUsernameSet])

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

  // Handle window resize for responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768

      // If switching to mobile view and sidebar is open, close it
      if (isMobile && showSidebar) {
        setShowSidebar(false)
      }
      // If switching to desktop view and sidebar is closed, open it
      else if (!isMobile && !showSidebar) {
        setShowSidebar(true)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
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
            // Check for mentions in new messages and show notifications
            trulyNewMessages.forEach(message => {
              // Don't notify for own messages
              if (message.username !== username.trim()) {
                const mentions = detectMentions(message.message)
                if (isUserMentioned(mentions, username.trim())) {
                  showMentionNotification(message.username, message.message)
                }
              }
            })

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

    // Save username to localStorage for persistence
    try {
      localStorage.setItem('chatapp-username', username.trim())
    } catch (error) {
      console.warn('Failed to save username to localStorage:', error)
    }
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
          message: newMessage.trim(),
          replyToId: replyingTo?.id || null,
          replyToUsername: replyingTo?.username || null,
          replyPreview: replyingTo?.message || null
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

      // Remove highlighting from any message being replied to
      document.querySelectorAll('.message.being-replied-to').forEach(el => {
        el.classList.remove('being-replied-to')
      })
      setReplyingTo(null) // Clear reply state after sending
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

  const handleLogout = () => {
    // Clear saved username from localStorage
    try {
      localStorage.removeItem('chatapp-username')
    } catch (error) {
      console.warn('Failed to remove username from localStorage:', error)
    }
    // Remove presence from server
    removePresence()
    // Reset state
    setUsername('')
    setIsUsernameSet(false)
    setMessages([])
    setOnlineUsers([])
    setTypingUsers([])
    setError(null)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Reply functionality handlers
  const handleReply = (message) => {
    setReplyingTo({
      id: message.id,
      username: message.username,
      message: message.message.substring(0, 100) // Preview first 100 chars
    })

    // Highlight the message being replied to
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`)
    if (messageElement) {
      // Remove any existing highlights first
      document.querySelectorAll('.message.being-replied-to').forEach(el => {
        el.classList.remove('being-replied-to')
      })

      // Add highlight to the message being replied to
      messageElement.classList.add('being-replied-to')
    }

    // Focus the input field
    messageInputRef.current?.focus()
  }

  const cancelReply = () => {
    // Remove highlighting from any message being replied to
    document.querySelectorAll('.message.being-replied-to').forEach(el => {
      el.classList.remove('being-replied-to')
    })
    setReplyingTo(null)
  }

  // Scroll to original message when reply reference is clicked
  const scrollToMessage = (messageId) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`)
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })

      // Temporarily highlight the message
      messageElement.classList.add('being-replied-to')
      setTimeout(() => {
        messageElement.classList.remove('being-replied-to')
      }, 2000)
    }
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
          <p className="profile-persistence-info">
            💾 Your username will be saved for future visits
          </p>
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
            <ThemeToggle />
            <div className="user-count">
              👥 {onlineUsers.length} online
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              aria-label="Logout and clear saved profile"
              title="Logout"
            >
              🚪
            </button>
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

      {/* Notification Permission Banner */}
      {isUsernameSet && notificationPermission === 'default' && (
        <div className="notification-banner">
          <span>🔔 Enable notifications to get alerted when someone mentions you!</span>
          <div className="notification-banner-actions">
            <button
              className="notification-enable-btn"
              onClick={async () => {
                const granted = await requestNotificationPermission()
                setNotificationPermission(granted ? 'granted' : 'denied')
              }}
            >
              Enable
            </button>
            <button
              className="notification-dismiss-btn"
              onClick={() => {
                setNotificationPermission('dismissed')
                try {
                  localStorage.setItem('chatapp-notification-dismissed', 'true')
                } catch (error) {
                  console.warn('Failed to save notification preference:', error)
                }
              }}
            >
              Dismiss
            </button>
          </div>
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
                  data-message-id={message.id}
                  className={`message ${message.username === username ? 'own-message' : ''}`}
                >
                  {/* Show compact reply reference if this is a reply - Discord style */}
                  {message.reply_to_id && (
                    <div
                      className="reply-reference"
                      onClick={() => scrollToMessage(message.reply_to_id)}
                      title="Click to jump to original message"
                    >
                      <span className="reply-icon">↳</span>
                      <span className="reply-to">
                        <strong>@{message.reply_to_username}</strong>
                        <span className="reply-preview">{message.reply_preview}</span>
                      </span>
                    </div>
                  )}

                  <div className="message-header">
                    <span className="message-username">{message.username}</span>
                    <span className="message-time">{formatTime(message.created_at)}</span>
                    <button
                      className="reply-btn"
                      onClick={() => handleReply(message)}
                      title={`Reply to ${message.username}`}
                      aria-label={`Reply to ${message.username}'s message`}
                    >
                      ↩️
                    </button>
                  </div>
                  <div
                    className="message-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.message, username) }}
                  />
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
        {/* Reply preview */}
        {replyingTo && (
          <div className="reply-preview">
            <div className="reply-preview-content">
              <span className="reply-preview-label">
                Replying to <strong>@{replyingTo.username}</strong>:
              </span>
              <span className="reply-preview-text">{replyingTo.message}</span>
            </div>
            <button
              type="button"
              className="reply-cancel-btn"
              onClick={cancelReply}
              aria-label="Cancel reply"
              title="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}

        {/* Typing indicators - dedicated space with no layout shift */}
        <div
          className={`typing-indicator-dedicated ${typingUsers.length > 0 ? 'visible' : 'hidden'}`}
          aria-live="polite"
          role="status"
        >
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
                : typingUsers.length > 0
                ? `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`
                : ''
              }
            </span>
          </div>
        </div>

        <div className="input-group">
          <input
            ref={messageInputRef}
            type="text"
            className="message-input"
            placeholder="Type your message..."
            value={newMessage}
            onChange={handleMessageInputChange}
            disabled={submitting}
            maxLength={1000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
          />
          <button
            type="submit"
            className="send-btn"
            disabled={submitting || !newMessage.trim()}
            aria-label={submitting ? 'Sending message...' : 'Send message'}
            title={submitting ? 'Sending...' : 'Send'}
          >
            {submitting ? '⏳' : '➤'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
