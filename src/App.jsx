import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ThemeToggle from './ThemeToggle'
import ImageUpload from './ImageUpload'
import ImagePreview from './ImagePreview'
import SpotifyAuth from './SpotifyAuth'
import JamSession from './JamSession'

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

// Sound Manager for audio notifications
class SoundManager {
  constructor() {
    this.sounds = {}
    this.volume = 0.7
    this.enabled = true
    this.initialized = false
    this.initializationPromise = null

    // Initialize sounds
    this.initializeSounds()
  }

  initializeSounds() {
    try {
      // Create programmatic sounds using Web Audio API
      this.audioContext = null
      this.sounds = {}

      // Initialize audio context on first user interaction
      this.createProgrammaticSounds()

      this.initialized = true
    } catch (error) {
      console.warn('Failed to initialize sounds:', error)
      this.enabled = false
    }
  }

  createProgrammaticSounds() {
    // Create different sound patterns for each notification type
    this.soundPatterns = {
      mention: { frequency: 800, duration: 0.3, type: 'sine' }, // High-pitched attention sound
      messageReceive: { frequency: 400, duration: 0.2, type: 'sine' }, // Gentle receive sound
      messageSend: { frequency: 600, duration: 0.15, type: 'triangle' }, // Quick send confirmation
      userOnline: { frequency: 500, duration: 0.25, type: 'square' } // User online notification
    }
  }

  async playSound(soundType) {
    if (!this.enabled || !this.initialized || !this.soundPatterns[soundType]) {
      return
    }

    try {
      // Initialize audio context if not already done
      if (!this.audioContext) {
        if (this.initializationPromise) {
          await this.initializationPromise
        } else {
          this.initializationPromise = this.initializeAudioContext()
          await this.initializationPromise
        }
      }

      // Resume audio context if suspended (required for autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const pattern = this.soundPatterns[soundType]

      // Create oscillator for the sound
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      // Connect nodes
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // Configure sound
      oscillator.frequency.setValueAtTime(pattern.frequency, this.audioContext.currentTime)
      oscillator.type = pattern.type

      // Configure volume envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + pattern.duration)

      // Play sound
      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + pattern.duration)

      // Clean up nodes after sound finishes to prevent memory leak
      oscillator.onended = () => {
        oscillator.disconnect()
        gainNode.disconnect()
      }

    } catch (error) {
      console.warn(`Failed to play ${soundType} sound:`, error)
      // Disable sounds if there's an error
      if (error.name === 'NotAllowedError') {
        console.warn('Audio blocked. Sounds will be enabled after user interaction.')
      }
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  setEnabled(enabled) {
    this.enabled = enabled
  }

  async initializeAudioContext() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    return this.audioContext
  }

  // Enable sounds after user interaction (required for autoplay policy)
  async enableAfterUserInteraction() {
    if (!this.initialized) return

    try {
      // Initialize audio context if not already done
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
        console.log('Audio context enabled after user interaction')
      }
    } catch (error) {
      console.warn('Failed to enable audio context:', error)
    }
  }
}

// Initialize sound manager
const soundManager = new SoundManager()

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

// Play sound for new messages (not mentions)
const playMessageSound = (isOwnMessage = false) => {
  if (isOwnMessage) {
    soundManager.playSound('messageSend')
  } else {
    soundManager.playSound('messageReceive')
  }
}

// Play sound when user comes online
const playUserOnlineSound = () => {
  soundManager.playSound('userOnline')
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

  // Sound settings state
  const [soundSettings, setSoundSettings] = useState({
    enabled: true,
    volume: 0.7,
    mentionSounds: true,
    messageSounds: true
  })

  // Settings menu state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  // Flag to prevent saving settings before they're loaded from localStorage
  const [soundSettingsLoaded, setSoundSettingsLoaded] = useState(false)

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState(null) // { id, username, message }

  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageMessage, setImageMessage] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)

  // Spotify integration states
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false)
  const [spotifyUserId, setSpotifyUserId] = useState(null)
  const [showJamSession, setShowJamSession] = useState(false)
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

  // Auto-focus message input when user joins chat
  useEffect(() => {
    if (isUsernameSet && messageInputRef.current) {
      // Small delay to ensure DOM is ready and any animations are complete
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus()
        }
      }, 100)
    }
  }, [isUsernameSet])

  // Load sound settings from localStorage
  useEffect(() => {
    try {
      const savedSoundSettings = localStorage.getItem('chatapp-sound-settings')
      if (savedSoundSettings) {
        const settings = JSON.parse(savedSoundSettings)
        setSoundSettings(settings)
        soundManager.setEnabled(settings.enabled)
        soundManager.setVolume(settings.volume)
      }
    } catch (error) {
      console.warn('Failed to load sound settings:', error)
    } finally {
      // Mark settings as loaded (whether we found saved settings or not)
      setSoundSettingsLoaded(true)
    }
  }, [])

  // Save sound settings to localStorage when they change (only after initial load)
  useEffect(() => {
    // Don't save until we've loaded the initial settings from localStorage
    if (!soundSettingsLoaded) return

    try {
      localStorage.setItem('chatapp-sound-settings', JSON.stringify(soundSettings))
      soundManager.setEnabled(soundSettings.enabled)
      soundManager.setVolume(soundSettings.volume)
    } catch (error) {
      console.warn('Failed to save sound settings:', error)
    }
  }, [soundSettings, soundSettingsLoaded])

  // Enable audio after user interaction (required for autoplay policy)
  useEffect(() => {
    const enableAudioOnInteraction = () => {
      soundManager.enableAfterUserInteraction()
      // Remove listener after first interaction
      document.removeEventListener('click', enableAudioOnInteraction)
      document.removeEventListener('keydown', enableAudioOnInteraction)
    }

    document.addEventListener('click', enableAudioOnInteraction)
    document.addEventListener('keydown', enableAudioOnInteraction)

    return () => {
      document.removeEventListener('click', enableAudioOnInteraction)
      document.removeEventListener('keydown', enableAudioOnInteraction)
    }
  }, [])

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
                  // Play mention sound and show notification
                  if (soundSettings.enabled && soundSettings.mentionSounds) {
                    showMentionNotification(message.username, message.message)
                  }
                } else {
                  // Play regular message receive sound for non-mention messages
                  if (soundSettings.enabled && soundSettings.messageSounds) {
                    playMessageSound(false) // false = not own message
                  }
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

      // Detect new users coming online (for sound notification)
      const previousUsernames = onlineUsers.map(user => user.username)
      const currentUsernames = users.map(user => user.username)
      const newUsers = currentUsernames.filter(username =>
        !previousUsernames.includes(username) && username !== username.trim()
      )

      // Play user online sound for new users (but not on initial load)
      if (onlineUsers.length > 0 && newUsers.length > 0 && soundSettings.enabled) {
        playUserOnlineSound()
      }

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

      // Play message send sound
      if (soundSettings.enabled && soundSettings.messageSounds) {
        playMessageSound(true) // true = own message
      }

      // Remove highlighting from any message being replied to
      document.querySelectorAll('.message.being-replied-to').forEach(el => {
        el.classList.remove('being-replied-to')
      })
      setReplyingTo(null) // Clear reply state after sending

      // Maintain focus on input field after sending message
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus()
        }
      }, 0)
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message. Please try again.')

      // Maintain focus even on error
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus()
        }
      }, 0)
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

  // Image upload handlers
  const handleImageSelect = (file) => {
    setSelectedImage(file)
    setImageMessage('')
  }

  const handleImageCancel = () => {
    setSelectedImage(null)
    setImageMessage('')
  }

  const handleImageSend = async (file, message) => {
    if (!file || uploadingImage) return

    try {
      setUploadingImage(true)
      setError(null)

      // Convert file to base64
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1]) // Remove data:image/...;base64, prefix
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          filename: file.name,
          fileData: fileData,
          message: message || `📷 ${file.name}`,
          replyToId: replyingTo?.id || null,
          replyToUsername: replyingTo?.username || null,
          replyPreview: replyingTo?.message || null
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setMessages(prev => [...prev, result.message])
      setLastMessageTime(result.message.created_at)
      setLastMessageId(result.message.id)
      lastMessageTimeRef.current = result.message.created_at
      lastMessageIdRef.current = result.message.id

      // Clear image upload state
      setSelectedImage(null)
      setImageMessage('')

      // Remove highlighting from any message being replied to
      document.querySelectorAll('.message.being-replied-to').forEach(el => {
        el.classList.remove('being-replied-to')
      })
      setReplyingTo(null) // Clear reply state after sending

      // Maintain focus on input field after sending message
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus()
        }
      }, 0)
    } catch (err) {
      console.error('Error uploading image:', err)
      setError('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleImageClick = (imageUrl, filename) => {
    setLightboxImage({ url: imageUrl, filename })
  }

  const closeLightbox = () => {
    setLightboxImage(null)
  }

  // Spotify authentication handlers
  const handleSpotifyAuthChange = (connected, userId) => {
    setIsSpotifyConnected(connected)
    setSpotifyUserId(userId)
  }

  const handleJamSessionOpen = () => {
    setShowJamSession(true)
  }

  const handleJamSessionClose = () => {
    setShowJamSession(false)
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
          <h1>🌟 Lumi Chat</h1>
          <p>Warm, soft light for coding and friendship</p>
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
            <h1>🌟 Lumi Chat</h1>
            <p>Welcome, <strong>{username}</strong>! ✨ Bringing warm light to your conversations</p>
          </div>
          <div className="header-right">
            <ThemeToggle />
            <div className="user-count">
              👥 {onlineUsers.length} online
            </div>
            <button
              className="settings-btn"
              onClick={handleJamSessionOpen}
              aria-label="Open Spotify jam sessions"
              title="Spotify Jam Sessions"
            >
              🎵
            </button>
            <button
              className="settings-btn"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              aria-label={showSettingsMenu ? 'Close settings menu' : 'Open settings menu'}
              aria-expanded={showSettingsMenu}
              title="Settings"
            >
              ⚙️
            </button>
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

      {/* Settings Menu Dropdown */}
      {isUsernameSet && showSettingsMenu && (
        <>
          {/* Settings backdrop overlay */}
          <div
            className="settings-backdrop"
            onClick={() => setShowSettingsMenu(false)}
            aria-hidden="true"
          />
          <div className="settings-menu">
            <div className="settings-menu-header">
              <h3>⚙️ Settings</h3>
              <button
                className="settings-close-btn"
                onClick={() => setShowSettingsMenu(false)}
                aria-label="Close settings menu"
              >
                ✕
              </button>
            </div>

            <div className="settings-section">
              <h4>🎵 Spotify Integration</h4>
              <SpotifyAuth
                username={username}
                onAuthChange={handleSpotifyAuthChange}
              />
            </div>

            <div className="settings-section">
              <h4>🔊 Sound Notifications</h4>
              <div className="settings-controls">
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={soundSettings.enabled}
                    onChange={(e) => setSoundSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Enable Sounds</span>
                </label>

                {soundSettings.enabled && (
                  <>
                    <div className="setting-item">
                      <label className="volume-control">
                        <span>Volume:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={soundSettings.volume}
                          onChange={(e) => setSoundSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                        />
                        <span>{Math.round(soundSettings.volume * 100)}%</span>
                      </label>
                    </div>

                    <label className="setting-item">
                      <input
                        type="checkbox"
                        checked={soundSettings.mentionSounds}
                        onChange={(e) => setSoundSettings(prev => ({ ...prev, mentionSounds: e.target.checked }))}
                      />
                      <span>@Mention sounds</span>
                    </label>

                    <label className="setting-item">
                      <input
                        type="checkbox"
                        checked={soundSettings.messageSounds}
                        onChange={(e) => setSoundSettings(prev => ({ ...prev, messageSounds: e.target.checked }))}
                      />
                      <span>Message sounds</span>
                    </label>

                    <div className="setting-item">
                      <button
                        className="sound-test-btn"
                        onClick={() => {
                          try {
                            // Ensure volume is updated before playing test sound
                            soundManager.setVolume(soundSettings.volume)
                            soundManager.playSound('mention')
                          } catch (error) {
                            console.warn('Failed to test sound:', error)
                          }
                        }}
                        title="Test mention sound"
                      >
                        🔊 Test Sound
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="chat-container">
        <div className="messages-container">
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>✨ Welcome to Lumi Chat!</h3>
                <p>Share your thoughts and let the warm light of conversation begin! 🌟</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`message ${message.username === username ? 'own-message' : ''} ${message.username === 'Lumi' ? 'lumi-message' : ''}`}
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

                  {/* Display image if message has one */}
                  {message.image_url && (
                    <div className="message-image-container">
                      <img
                        src={message.image_url}
                        alt={`Image from ${message.username}${message.image_filename ? ` – ${message.image_filename}` : ''}`}
                        className="message-image"
                        onClick={() => handleImageClick(message.image_url, message.image_filename)}
                        loading="lazy"
                      />
                      {message.image_filename && (
                        <div className="message-image-filename">
                          📎 {message.image_filename}
                        </div>
                      )}
                    </div>
                  )}
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
          <ImageUpload
            onImageSelect={handleImageSelect}
            disabled={submitting || uploadingImage}
          />
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
            disabled={submitting || uploadingImage || !newMessage.trim()}
            aria-label={submitting ? 'Sending message...' : 'Send message'}
            title={submitting ? 'Sending...' : 'Send'}
          >
            {submitting ? '⏳' : '➤'}
          </button>
        </div>
      </form>

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreview
          file={selectedImage}
          message={imageMessage}
          setMessage={setImageMessage}
          onCancel={handleImageCancel}
          onSend={handleImageSend}
          disabled={uploadingImage}
        />
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="image-lightbox" onClick={closeLightbox}>
          <button
            className="image-lightbox-close"
            onClick={closeLightbox}
            aria-label="Close image"
          >
            ✕
          </button>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.filename || 'Image'}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Spotify Jam Session Modal */}
      {showJamSession && (
        <JamSession
          username={username}
          isSpotifyConnected={isSpotifyConnected}
          onClose={handleJamSessionClose}
        />
      )}
    </div>
  )
}

export default App
