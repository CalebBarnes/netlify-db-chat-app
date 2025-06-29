import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import ThemeToggle from './ThemeToggle'
import DirectMessages from './DirectMessages'
import DMConversation from './DMConversation'
import ImageUpload from './ImageUpload'
import ImagePreview from './ImagePreview'
import Avatar from './Avatar'
import AvatarUpload from './AvatarUpload'


// 🚨 ICON SYSTEM: Replace emojis with proper Lucide icons for clarity
import { Reply, Send, X, Settings, Users, LogOut, Plus, Upload, Github, ChevronDown, User, MessageCircle } from 'lucide-react'

// Configure marked for safe rendering with proper line break handling
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true, // Enable GitHub Flavored Markdown
  sanitize: false, // We'll handle sanitization manually
  smartLists: true,
  smartypants: false
})

// Custom renderer to ensure line breaks are properly handled
const renderer = new marked.Renderer()
renderer.paragraph = (text) => {
  // Ensure paragraphs preserve line breaks
  return `<p>${text}</p>`
}

// Detect @mentions in message text (only for actual users)
const detectMentions = (message, validUsernames = []) => {
  if (!validUsernames.length) return []

  const mentions = []

  // Create regex patterns for each valid username
  validUsernames.forEach(username => {
    const escapedUsername = escapeRegex(username)
    // Match @username with word boundaries (space, punctuation, start/end of string)
    const userRegex = new RegExp(`@(${escapedUsername})(?=\\s|$|[^a-zA-Z0-9_\\s-])`, 'gi')
    const matches = message.match(userRegex)
    if (matches) {
      matches.forEach(match => {
        const mentionedUser = match.substring(1) // Remove @ symbol
        if (!mentions.includes(mentionedUser)) {
          mentions.push(mentionedUser)
        }
      })
    }
  })

  return mentions
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

// Discord-style Actions Menu Component (moved outside to prevent re-renders)
const ActionsMenu = React.memo(({ showActionsMenu, onFileUploadClick }) => {
  if (!showActionsMenu) return null

  return (
    <div className="actions-menu">
      <div className="actions-menu-content">
        <button
          type="button"
          className="action-item"
          onClick={onFileUploadClick}
          title="Upload a file"
        >
          <Upload size={18} />
          <span>Upload a File</span>
        </button>
      </div>
    </div>
  )
})

// @ Mentions Autocomplete Component
const MentionsAutocomplete = React.memo(({
  show,
  users,
  selectedIndex,
  onSelect,
  position
}) => {
  if (!show || !users.length) return null

  const getStatusIndicator = (user) => {
    if (user.is_typing) return { icon: '✏️', text: 'typing...' }

    switch (user.status) {
      case 'online':
        return { icon: '🟢', text: 'online' }
      case 'recently_active':
        return { icon: '🟡', text: 'recently active' }
      case 'offline':
        return { icon: '⚫', text: 'offline' }
      default:
        return { icon: '⚫', text: 'offline' }
    }
  }

  return (
    <div
      className="mentions-autocomplete"
      style={{
        position: 'absolute',
        bottom: position?.bottom || '60px',
        left: position?.left || '60px',
        zIndex: 1001
      }}
    >
      <div className="mentions-autocomplete-content">
        <div className="mentions-autocomplete-header">
          <span>@ Mention Users</span>
        </div>
        {users.map((user, index) => {
          const statusInfo = getStatusIndicator(user)
          return (
            <button
              key={user.username}
              type="button"
              className={`mention-item ${index === selectedIndex ? 'selected' : ''} ${user.status}`}
              onClick={() => onSelect(user)}
              title={`Mention ${user.username} (${statusInfo.text})`}
            >
              <div className="mention-user-info">
                <span className="mention-username">@{user.username}</span>
                <span className="mention-status">
                  <span className="status-indicator">{statusInfo.icon}</span>
                  {statusInfo.text}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
})

// User Menu Component (combines Settings + Logout)
const UserMenu = React.memo(({
  show,
  username,
  currentUserAvatar,
  onSettingsClick,
  onAvatarUploadClick,
  onLogoutClick,
  onClose
}) => {
  if (!show) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="user-menu-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="user-menu">
        <div className="user-menu-header">
          <div className="user-avatar" onClick={onAvatarUploadClick}>
            <Avatar
              username={username}
              size={40}
              className="clickable"
              onClick={onAvatarUploadClick}
            />
          </div>
          <div className="user-info">
            <div className="user-name">{username}</div>
            <div className="user-status">Online</div>
          </div>
        </div>
        <div className="user-menu-divider" />
        <div className="user-menu-actions">
          <button
            className="user-menu-item"
            onClick={onAvatarUploadClick}
          >
            <Upload size={16} />
            <span>Change Avatar</span>
          </button>
          <button
            className="user-menu-item"
            onClick={onSettingsClick}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button
            className="user-menu-item logout"
            onClick={onLogoutClick}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  )
})

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
const renderMarkdown = (text, currentUser = '', validUsernames = []) => {
  if (!text) return ''

  try {
    // First highlight @mentions before markdown processing
    let processedText = text

    if (validUsernames.length > 0) {
      // Highlight mentions for all valid users
      validUsernames.forEach(username => {
        const escapedUsername = escapeRegex(username)
        // Match @username with proper word boundaries
        const userRegex = new RegExp(`@(${escapedUsername})(?=\\s|$|[^a-zA-Z0-9_\\s-])`, 'gi')

        if (username.toLowerCase() === currentUser.toLowerCase()) {
          // Highlight current user mentions with special styling
          processedText = processedText.replace(userRegex, '<mark class="mention-highlight">@$1</mark>')
        } else {
          // Highlight other user mentions with regular styling
          processedText = processedText.replace(userRegex, '<span class="mention">@$1</span>')
        }
      })
    }

    // Manually convert line breaks to ensure they work
    // Replace single line breaks with double spaces + line break (markdown line break syntax)
    const textWithLineBreaks = processedText.replace(/\n/g, '  \n')

    // Then convert markdown to HTML
    const html = marked(textWithLineBreaks)

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

// Main Chat Component (uses router hooks)
function MainChat() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [allKnownUsernames, setAllKnownUsernames] = useState([])
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

  // User dropdown menu state (combines settings + logout)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Flag to prevent saving settings before they're loaded from localStorage
  const [soundSettingsLoaded, setSoundSettingsLoaded] = useState(false)

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState(null) // { id, username, message, mentionEnabled }

  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageMessage, setImageMessage] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)

  // @ Mentions autocomplete states
  const [showMentionsAutocomplete, setShowMentionsAutocomplete] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartPos, setMentionStartPos] = useState(0)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [filteredUsers, setFilteredUsers] = useState([])
  const [allParticipants, setAllParticipants] = useState([])

  // Avatar upload states
  const [showAvatarUpload, setShowAvatarUpload] = useState(false)
  const [currentUserAvatar, setCurrentUserAvatar] = useState(null)
  const [avatarRefreshTrigger, setAvatarRefreshTrigger] = useState(0)

  // Check if we're in DM mode based on current route
  const isInDMMode = location.pathname.startsWith('/dm')

  // Extract DM target username from URL if in DM conversation mode
  const dmTargetUsername = isInDMMode && location.pathname.startsWith('/dm/')
    ? decodeURIComponent(location.pathname.split('/dm/')[1])
    : null

  // Determine if we're in a specific DM conversation vs DM list
  const isInDMConversation = dmTargetUsername !== null

  // Helper function to get the correct username field from a message
  // Main chat messages use 'username', DM messages use 'sender_username'
  const getMessageUsername = (message) => {
    return message.sender_username || message.username
  }

  const messagesEndRef = useRef(null)
  const messageInputRef = useRef(null)
  const lastMessageTimeRef = useRef(null)
  const lastMessageIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Extract all known usernames from messages and online users
  const updateKnownUsernames = useCallback(() => {
    const usernames = new Set()

    // Add usernames from messages
    messages.forEach(message => {
      if (message.username) {
        usernames.add(message.username)
      }
    })

    // Add usernames from online users
    onlineUsers.forEach(user => {
      if (user.username) {
        usernames.add(user.username)
      }
    })

    setAllKnownUsernames(Array.from(usernames))
  }, [messages, onlineUsers])

  // Update known usernames when messages or online users change
  useEffect(() => {
    updateKnownUsernames()
  }, [updateKnownUsernames])

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

  // Clear messages and fetch new ones when route changes
  useEffect(() => {
    if (isUsernameSet) {
      // Clear previous messages when switching between main chat and DMs
      setMessages([])
      setLastMessageId(null)
      setLastMessageTime(null)
      lastMessageIdRef.current = null
      lastMessageTimeRef.current = null

      // Only fetch messages if we're not on the DM list page
      // DM list page (/dm) should not show any messages
      if (!isInDMMode || isInDMConversation) {
        fetchMessages()
      } else {
        // For DM list page, just set loading to false since we don't need to fetch messages
        setLoading(false)
      }
    }
  }, [isUsernameSet, isInDMMode, dmTargetUsername])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Set up real-time polling when username is set
  useEffect(() => {
    if (isUsernameSet) {
      // Combined polling for better performance - reduces requests by 50%
      const combinedInterval = setInterval(() => {
        if (!isInDMConversation) {
          // Main chat: use combined endpoint for efficiency
          fetchChatState()
        } else {
          // DM conversations: use separate polling for messages and presence
          fetchNewMessages() // DM-specific message polling
          fetchOnlineUsers() // Still need presence for sidebar
        }
        updatePresence() // Always update our own presence
      }, 2000) // Poll every 2 seconds - optimal balance for 50% request reduction

      // Initial data fetch
      updatePresence()
      if (!isInDMConversation) {
        fetchChatState()
      } else {
        fetchOnlineUsers() // Need initial presence for DM mode
      }
      fetchAllParticipants() // Load all participants for mentions

      return () => {
        clearInterval(combinedInterval)
        // Clear typing timeout and remove user from presence when component unmounts
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        handleTypingStop()
        removePresence()
      }
    }
  }, [isUsernameSet, isInDMConversation]) // Depend on both username and DM mode

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

  // Handle escape key to close sidebar, actions menu, and user menu
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        if (showActionsMenu) {
          setShowActionsMenu(false)
        } else if (showSettingsMenu) {
          setShowSettingsMenu(false)
        } else if (showUserMenu) {
          setShowUserMenu(false)
        } else if (showSidebar) {
          setShowSidebar(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showSidebar, showActionsMenu, showSettingsMenu, showUserMenu])

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsMenu) {
        const target = event.target
        const isInsideContainer = target.closest('.actions-button-container')
        const isInsideMenu = target.closest('.actions-menu')
        const isFileInput = target.type === 'file'

        // Don't close if clicking inside the container, menu, or file input
        if (!isInsideContainer && !isInsideMenu && !isFileInput) {
          setShowActionsMenu(false)
        }
      }
    }

    // Use mousedown instead of click to prevent interference with file input
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showActionsMenu])

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

      // Choose endpoint based on chat mode
      let endpoint = '/api/messages'
      if (isInDMConversation) {
        // For DM conversations, get messages for specific conversation
        try {
          const conversationId = await getOrCreateConversationId(dmTargetUsername)
          endpoint = `/.netlify/functions/direct-messages?conversationId=${conversationId}&username=${encodeURIComponent(username.trim())}`
        } catch (error) {
          console.error('Error getting conversation ID:', error)
          setError('Failed to load conversation')
          setLoading(false)
          return
        }
      }

      const response = await fetch(endpoint)
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

  // Combined function to fetch both messages and presence in one call
  const fetchChatState = async () => {
    if (!lastMessageIdRef.current) return

    try {
      // Use combined endpoint for main chat only (DMs still use separate polling)
      const params = new URLSearchParams({
        username: username.trim(),
        sinceId: lastMessageIdRef.current.toString()
      })

      const response = await fetch(`/.netlify/functions/chat-state?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const { messages: newMessages, presence, typing } = await response.json()

      // Handle new messages (same logic as before)
      if (newMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id))
          const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))

          if (trulyNewMessages.length > 0) {
            // Check for mentions in new messages and show notifications
            trulyNewMessages.forEach(message => {
              // Don't notify for own messages
              if (message.username !== username.trim()) {
                const mentions = detectMentions(message.message, allKnownUsernames)
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

      // Handle presence updates (same logic as fetchOnlineUsers)
      if (presence) {
        // Define AI assistants that should always appear in the list
        const aiAssistants = [
          {
            username: 'Lumi',
            type: 'ai',
            status: 'online',
            indicator: '⭐',
            description: 'AI Assistant',
            is_typing: false,
            last_seen: new Date().toISOString()
          }
        ]

        // Combine AI assistants with human users (AI assistants first)
        const allUsers = [...aiAssistants, ...presence]

        // Detect new users coming online (for sound notification) - only for human users
        const previousUsernames = onlineUsers
          .filter(user => user.type !== 'ai')
          .map(user => user.username)
        const currentUsernames = presence.map(user => user.username)
        const newUsers = currentUsernames.filter(u =>
          !previousUsernames.includes(u) && u !== username.trim()
        )

        // Play user online sound for new users (but not on initial load)
        if (onlineUsers.length > 0 && newUsers.length > 0 && soundSettings.enabled) {
          playUserOnlineSound()
        }

        setOnlineUsers(allUsers)

        // Update typing users
        if (typing) {
          const currentlyTyping = typing.filter(user => user !== username.trim())
          setTypingUsers(currentlyTyping)
        }
      }
    } catch (err) {
      console.error('Error fetching chat state:', err)
      // Don't show error for polling failures to avoid spam
    }
  }

  // Keep the old fetchNewMessages for DM conversations
  const fetchNewMessages = async () => {
    if (!lastMessageIdRef.current) return

    try {
      // This is now only used for DM conversations
      let endpoint
      if (isInDMConversation) {
        try {
          const conversationId = await getOrCreateConversationId(dmTargetUsername)
          endpoint = `/.netlify/functions/direct-messages?conversationId=${conversationId}&username=${encodeURIComponent(username.trim())}&sinceId=${lastMessageIdRef.current}`
        } catch (error) {
          console.error('Error getting conversation ID for new messages:', error)
          return
        }
      } else {
        // Main chat now uses fetchChatState instead
        return
      }

      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const newMessages = await response.json()

      if (newMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id))
          const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))

          if (trulyNewMessages.length > 0) {
            // Update refs with the latest message info
            const latestMessage = trulyNewMessages[trulyNewMessages.length - 1]
            lastMessageTimeRef.current = latestMessage.created_at
            lastMessageIdRef.current = latestMessage.id
            setLastMessageTime(latestMessage.created_at)
            setLastMessageId(latestMessage.id)

            return [...prev, ...trulyNewMessages]
          }
          return prev
        })
      }
    } catch (err) {
      console.error('Error fetching new messages:', err)
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
      const humanUsers = await response.json()

      // Define AI assistants that should always appear in the list
      const aiAssistants = [
        {
          username: 'Lumi',
          type: 'ai',
          status: 'online',
          indicator: '⭐',
          description: 'AI Assistant',
          is_typing: false,
          last_seen: new Date().toISOString()
        }
      ]

      // Combine AI assistants with human users (AI assistants first)
      const allUsers = [...aiAssistants, ...humanUsers]

      // Detect new users coming online (for sound notification) - only for human users
      const previousUsernames = onlineUsers
        .filter(user => user.type !== 'ai')
        .map(user => user.username)
      const currentUsernames = humanUsers.map(user => user.username)
      const newUsers = currentUsernames.filter(u =>
        !previousUsernames.includes(u) && u !== username.trim()
      )

      // Play user online sound for new users (but not on initial load)
      if (onlineUsers.length > 0 && newUsers.length > 0 && soundSettings.enabled) {
        playUserOnlineSound()
      }

      setOnlineUsers(allUsers)

      // Extract typing users (excluding current user and AI assistants)
      const currentlyTyping = humanUsers
        .filter(user => user.is_typing && user.username !== username.trim())
        .map(user => user.username)
      setTypingUsers(currentlyTyping)
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  // Fetch all chat participants (online and offline)
  const fetchAllParticipants = async (query = '') => {
    try {
      const params = new URLSearchParams()
      if (query.trim()) {
        params.append('query', query.trim())
      }
      params.append('limit', '20')

      const response = await fetch(`/.netlify/functions/participants?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAllParticipants(data.participants)

        // Update all known usernames for mention detection
        const usernames = data.participants.map(p => p.username)
        setAllKnownUsernames(prev => {
          const combined = [...new Set([...prev, ...usernames])]
          return combined
        })

        return data.participants
      }
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
    return []
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

  // Helper function to get or create conversation ID for DMs
  const getOrCreateConversationId = async (targetUsername) => {
    try {
      // First, try to get existing conversations to find this one
      const conversationsResponse = await fetch(
        `/.netlify/functions/direct-messages?username=${encodeURIComponent(username.trim())}`
      )

      if (conversationsResponse.ok) {
        const conversations = await conversationsResponse.json()
        const existingConversation = conversations.find(
          conv => conv.other_username && conv.other_username.toLowerCase() === targetUsername.toLowerCase()
        )

        if (existingConversation) {
          return existingConversation.id
        }
      }

      // If no existing conversation, create an empty one
      const payload = {
        username: username.trim(),
        recipientUsername: targetUsername,
        createEmpty: true // Flag to create conversation without sending a message
      }

      console.log('Creating empty conversation with payload:', payload)

      const createResponse = await fetch('/.netlify/functions/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error('Create conversation error response:', errorText)
        throw new Error(`Failed to create conversation: ${createResponse.status} - ${errorText}`)
      }

      const result = await createResponse.json()
      return result.conversation_id
    } catch (error) {
      console.error('Error getting/creating conversation:', error)
      throw error
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      setSubmitting(true)
      setError(null)

      // Stop typing indicator when sending message
      handleTypingStop()

      // Choose endpoint based on chat mode
      const endpoint = isInDMConversation ? '/.netlify/functions/direct-messages' : '/api/messages'

      // Prepare payload based on chat mode
      const payload = {
        username: username.trim(),
        message: newMessage.trim(),
        replyToId: replyingTo?.id || null,
        replyToUsername: replyingTo?.username || null,
        replyPreview: replyingTo?.message || null
      }

      // Add DM-specific fields if in DM mode
      if (isInDMConversation) {
        // Get or create conversation ID for this DM
        const conversationId = await getOrCreateConversationId(dmTargetUsername)
        payload.conversationId = conversationId
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setNewMessage(value)

    // Discord-style auto-resize: only expand if content has line breaks or overflows
    const textarea = e.target

    // Reset to single line height first
    textarea.style.height = 'auto'

    // Check if we need multiple lines (either line breaks or text overflow)
    const hasLineBreaks = value.includes('\n')
    const singleLineHeight = 50 // Base height for single line

    if (hasLineBreaks || textarea.scrollHeight > singleLineHeight) {
      // Expand to fit content, but cap at max height
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    } else {
      // Keep single line height
      textarea.style.height = singleLineHeight + 'px'
    }

    // Check for @ mentions autocomplete
    handleMentionDetection(value, cursorPos)

    // Trigger typing indicator when user starts typing
    if (value.trim().length > 0) {
      handleTypingStart()
    } else if (isTyping) {
      handleTypingStop()
    }
  }

  // Handle @ mention detection and autocomplete
  const handleMentionDetection = async (value, cursorPos) => {
    // Find the last @ before the cursor position
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex === -1) {
      // No @ found, hide autocomplete
      setShowMentionsAutocomplete(false)
      return
    }

    // Check if there's a space between @ and cursor (which would end the mention)
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      setShowMentionsAutocomplete(false)
      return
    }

    // Check if @ is at start of message or preceded by whitespace
    const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
    if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && lastAtIndex !== 0) {
      setShowMentionsAutocomplete(false)
      return
    }

    // Extract the query after @
    const query = textAfterAt.toLowerCase()
    setMentionQuery(query)
    setMentionStartPos(lastAtIndex)

    // Fetch participants based on query (includes both online and offline users)
    const participants = await fetchAllParticipants(query)

    // Filter out current user and format for autocomplete
    const filtered = participants
      .filter(participant => participant.username !== username.trim())
      .map(participant => ({
        username: participant.username,
        status: participant.status,
        is_typing: participant.is_typing || false,
        last_message_at: participant.last_message_at,
        message_count: participant.message_count
      }))

    setFilteredUsers(filtered)
    setSelectedMentionIndex(0)
    setShowMentionsAutocomplete(filtered.length > 0)
  }

  // Handle mention selection
  const handleMentionSelect = (user) => {
    const beforeMention = newMessage.substring(0, mentionStartPos)
    const afterCursor = newMessage.substring(messageInputRef.current.selectionStart)
    const newValue = beforeMention + `@${user.username} ` + afterCursor

    setNewMessage(newValue)
    setShowMentionsAutocomplete(false)

    // Focus back to input and position cursor after the mention
    setTimeout(() => {
      if (messageInputRef.current) {
        const newCursorPos = beforeMention.length + user.username.length + 2 // +2 for @ and space
        messageInputRef.current.focus()
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  // Handle Discord-style keyboard shortcuts
  const handleKeyDown = (e) => {
    // Handle mentions autocomplete navigation
    if (showMentionsAutocomplete && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        )
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(prev =>
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        )
        return
      }

      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        handleMentionSelect(filteredUsers[selectedMentionIndex])
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionsAutocomplete(false)
        return
      }
    }

    // Enter without Shift = send message (only if not in mentions autocomplete)
    if (e.key === 'Enter' && !e.shiftKey && !showMentionsAutocomplete) {
      e.preventDefault()
      sendMessage(e)
    }
    // Shift+Enter = line break (default textarea behavior, no need to handle)
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
    const messageUsername = getMessageUsername(message)
    const replyState = {
      id: message.id,
      username: messageUsername,
      message: message.message.substring(0, 100), // Preview first 100 chars
      mentionEnabled: true // Default to ON
    }

    setReplyingTo(replyState)

    // Auto-add @username to message input if mention enabled
    if (replyState.mentionEnabled && !newMessage.includes(`@${messageUsername}`)) {
      const currentMessage = newMessage.trim()
      const mentionText = `@${messageUsername} `
      setNewMessage(currentMessage ? `${mentionText}${currentMessage}` : mentionText)
    }

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

  const toggleMention = () => {
    if (!replyingTo) return

    const newMentionState = !replyingTo.mentionEnabled
    const mentionText = `@${replyingTo.username} `

    setReplyingTo(prev => ({ ...prev, mentionEnabled: newMentionState }))

    // Update message input based on new mention state
    if (newMentionState) {
      // Add @username if not already present
      if (!newMessage.includes(`@${replyingTo.username}`)) {
        const currentMessage = newMessage.trim()
        setNewMessage(currentMessage ? `${mentionText}${currentMessage}` : mentionText)
      }
    } else {
      // Remove @username from message
      const updatedMessage = newMessage.replace(new RegExp(`@${replyingTo.username}\\s*`, 'g'), '').trim()
      setNewMessage(updatedMessage)
    }
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

  // Discord-style actions menu handlers
  const toggleActionsMenu = () => {
    setShowActionsMenu(!showActionsMenu)
  }

  const closeActionsMenu = () => {
    setShowActionsMenu(false)
  }

  // Image upload handlers
  const handleImageSelect = (file) => {
    setSelectedImage(file)
    setImageMessage('')
    setShowActionsMenu(false) // Close menu after selecting file
  }

  // Handle file upload from actions menu
  const handleFileUploadClick = useCallback(() => {
    // Close the menu first to prevent flashing
    setShowActionsMenu(false)
    // Small delay to ensure menu is closed before triggering file input
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }, 100)
  }, [])

  // Function to start a DM with a specific user
  const startDMWithUser = useCallback((targetUsername) => {
    if (targetUsername === username) {
      // Don't allow DMing yourself
      return
    }
    // Navigate to DM with specific user
    navigate(`/dm/${targetUsername}`)
  }, [username, navigate])

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

  // Avatar functionality handlers
  const fetchCurrentUserAvatar = async () => {
    if (!username.trim()) return

    try {
      const response = await fetch(`/.netlify/functions/user-avatar?username=${encodeURIComponent(username.trim())}`)
      const result = await response.json()

      if (response.ok && result.hasAvatar) {
        setCurrentUserAvatar(result.avatar.avatarUrl)
      } else {
        setCurrentUserAvatar(null)
      }
    } catch (error) {
      console.error('Error fetching user avatar:', error)
      setCurrentUserAvatar(null)
    }
  }

  const handleAvatarUpdate = (newAvatarUrl) => {
    setCurrentUserAvatar(newAvatarUrl)
    // Force Avatar component to re-fetch by updating a trigger
    setAvatarRefreshTrigger(Date.now())
  }

  const handleAvatarUploadClick = () => {
    setShowAvatarUpload(true)
  }

  const closeAvatarUpload = () => {
    setShowAvatarUpload(false)
  }

  // Fetch current user's avatar when username is set
  useEffect(() => {
    if (isUsernameSet && username.trim()) {
      fetchCurrentUserAvatar()
    }
  }, [isUsernameSet, username])

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
            {isInDMConversation ? (
              // DM conversation header
              <>
                <button
                  onClick={() => navigate('/dm')}
                  className="back-button"
                  aria-label="Back to DM list"
                >
                  ←
                </button>
                <h1>💬 {dmTargetUsername}</h1>
                <p>Direct message conversation</p>
              </>
            ) : isInDMMode ? (
              // DM list header
              <>
                <button
                  onClick={() => navigate('/')}
                  className="back-button"
                  aria-label="Back to main chat"
                >
                  ←
                </button>
                <h1>💬 Direct Messages</h1>
                <p>Your private conversations</p>
              </>
            ) : (
              // Main chat header
              <>
                <h1>🌟 Lumi Chat</h1>
                <p>Welcome, <strong>{username}</strong>! ✨ Bringing warm light to your conversations</p>
              </>
            )}
          </div>
          <div className="header-right">
            {/* Primary actions - GitHub link */}
            <a
              href="https://github.com/CalebBarnes/netlify-db-chat-app"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
              aria-label="View source code on GitHub"
              title="View source code on GitHub"
            >
              <Github size={18} />
            </a>

            {/* Direct Messages button */}
            <button
              className="dm-button"
              onClick={() => navigate(isInDMMode ? '/' : '/dm')}
              aria-label={isInDMMode ? 'Back to main chat' : 'Open direct messages'}
            >
              <MessageCircle size={18} />
            </button>

            {/* Sidebar toggle with user count in tooltip */}
            <button
              className="sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              aria-label={showSidebar ? 'Close online users panel' : 'Open online users panel'}
              aria-expanded={showSidebar}
              title={`${onlineUsers.length} users online`}
            >
              <Users size={18} />
            </button>

            {/* User avatar dropdown (combines Settings + Logout) */}
            <div className="user-avatar-container">
              <button
                className="user-avatar-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="Open user menu"
                aria-expanded={showUserMenu}
                title={`${username} - User menu`}
              >
                <Avatar
                  username={username}
                  size={24}
                  className="header-avatar"
                />
                <ChevronDown size={14} className="dropdown-arrow" />
              </button>

              {/* User Menu Dropdown - positioned relative to button */}
              {isUsernameSet && (
                <UserMenu
                  show={showUserMenu}
                  username={username}
                  currentUserAvatar={currentUserAvatar}
                  onSettingsClick={() => {
                    setShowUserMenu(false)
                    setShowSettingsMenu(true)
                  }}
                  onAvatarUploadClick={() => {
                    setShowUserMenu(false)
                    handleAvatarUploadClick()
                  }}
                  onLogoutClick={() => {
                    setShowUserMenu(false)
                    handleLogout()
                  }}
                  onClose={() => setShowUserMenu(false)}
                />
              )}
            </div>
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
              <h3><Settings size={18} /> Settings</h3>
              <button
                className="settings-close-btn"
                onClick={() => setShowSettingsMenu(false)}
                aria-label="Close settings menu"
              >
                ✕
              </button>
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

      {/* Conditional content based on route */}
      {isInDMMode && !isInDMConversation ? (
        // DM List View - show conversation list
        <DirectMessages
          username={username}
          onBack={() => navigate('/')}
          soundSettings={soundSettings}
          playMessageSound={playMessageSound}
        />
      ) : (
        // Main chat or DM conversation - show messages
        <>
          <div className="chat-container">
            <div className="messages-container">
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    {isInDMConversation ? (
                      <>
                        <h3>💬 Start a conversation</h3>
                        <p>Send a message to {dmTargetUsername} to begin your conversation!</p>
                      </>
                    ) : (
                      <>
                        <h3>✨ Welcome to Lumi Chat!</h3>
                        <p>Share your thoughts and let the warm light of conversation begin! 🌟</p>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map(message => (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`message ${getMessageUsername(message) === username ? 'own-message' : ''}`}
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
                    <Avatar
                      username={getMessageUsername(message)}
                      size={24}
                      className="message-avatar"
                    />
                    <span
                      className={`message-username ${getMessageUsername(message) !== username ? 'clickable' : ''}`}
                      onClick={() => getMessageUsername(message) !== username && startDMWithUser(getMessageUsername(message))}
                      title={getMessageUsername(message) !== username ? `Send message to ${getMessageUsername(message)}` : undefined}
                    >
                      {getMessageUsername(message)}
                    </span>
                    <span className="message-time">{formatTime(message.created_at)}</span>
                    <button
                      className="reply-btn"
                      onClick={() => handleReply(message)}
                      title={`Reply to ${getMessageUsername(message)}`}
                      aria-label={`Reply to ${getMessageUsername(message)}'s message`}
                    >
                      <Reply size={14} />
                    </button>
                  </div>
                  <div
                    className="message-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.message, username, allKnownUsernames) }}
                  />

                  {/* Display image if message has one */}
                  {message.image_url && (
                    <div className="message-image-container">
                      <img
                        src={message.image_url}
                        alt={`Image from ${getMessageUsername(message)}${message.image_filename ? ` – ${message.image_filename}` : ''}`}
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
                <h3><Users size={18} /> Online Users</h3>
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
                    className={`online-user ${user.username === username ? 'current-user' : ''} ${user.type === 'ai' ? 'ai-user' : 'human-user'} ${user.username !== username ? 'clickable' : ''}`}
                    onClick={() => user.username !== username && startDMWithUser(user.username)}
                    title={user.username !== username ? `Send message to ${user.username}` : undefined}
                  >
                    <div className="user-status">
                      <span className={`status-indicator ${user.type === 'ai' ? 'ai-indicator' : 'status-dot'}`}>
                        {user.type === 'ai' ? user.indicator : ''}
                      </span>
                      <span className="username">{user.username}</span>
                      {user.type === 'ai' && (
                        <span className="user-type-label">({user.description})</span>
                      )}
                    </div>
                    <div className="user-actions">
                      {user.username === username && (
                        <span className="you-label">(you)</span>
                      )}
                      {user.username !== username && (
                        <span className="dm-hint">💬</span>
                      )}
                    </div>
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
            <div className="reply-controls">
              <button
                type="button"
                className={`mention-toggle ${replyingTo.mentionEnabled ? 'on' : 'off'}`}
                onClick={toggleMention}
                title={replyingTo.mentionEnabled ?
                  "Click to disable pinging the original author" :
                  "Click to enable pinging the original author"
                }
                aria-label={`Mention toggle: ${replyingTo.mentionEnabled ? 'ON' : 'OFF'}`}
              >
                @ {replyingTo.mentionEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className="reply-cancel-btn"
                onClick={cancelReply}
                aria-label="Cancel reply"
                title="Cancel reply"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="input-group">
          {/* Discord-style + button with actions menu */}
          <div className="actions-button-container">
            <button
              type="button"
              className={`actions-button ${showActionsMenu ? 'active' : ''}`}
              onClick={toggleActionsMenu}
              disabled={submitting || uploadingImage}
              aria-label="Open actions menu"
              title="Upload files and more"
            >
              <Plus size={20} />
            </button>
            <ActionsMenu
              showActionsMenu={showActionsMenu}
              onFileUploadClick={handleFileUploadClick}
            />

            <MentionsAutocomplete
              show={showMentionsAutocomplete}
              users={filteredUsers}
              selectedIndex={selectedMentionIndex}
              onSelect={handleMentionSelect}
              position={{ bottom: '60px', left: '60px' }}
            />

            {/* Hidden file input for upload functionality */}
            <ImageUpload
              ref={fileInputRef}
              onImageSelect={handleImageSelect}
              disabled={submitting || uploadingImage}
            />
          </div>
          <textarea
            ref={messageInputRef}
            className="message-input"
            placeholder={
              isInDMConversation
                ? `Message ${dmTargetUsername}... (Shift+Enter for line breaks)`
                : "Type your message... (Shift+Enter for line breaks)"
            }
            value={newMessage}
            onChange={handleMessageInputChange}
            onKeyDown={handleKeyDown}
            disabled={submitting}
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
            className="send-btn"
            disabled={submitting || uploadingImage || !newMessage.trim()}
            aria-label={submitting ? 'Sending message...' : 'Send message'}
            title={submitting ? 'Sending...' : 'Send'}
          >
            {submitting ? '⏳' : <Send size={16} />}
          </button>
        </div>

        {/* Discord-style typing indicator below input */}
        <div
          className={`typing-indicator-below ${typingUsers.length > 0 ? 'visible' : 'hidden'}`}
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
      </form>
        </>
      )}

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

      {/* DM Mode is now handled by the unified MainChat component through routing */}

      {/* Avatar Upload Modal */}
      {showAvatarUpload && (
        <AvatarUpload
          username={username}
          currentAvatarUrl={currentUserAvatar}
          onAvatarUpdate={handleAvatarUpdate}
          onClose={closeAvatarUpload}
        />
      )}
    </div>
  )
}

// Router wrapper component that handles all routing
function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainChat />} />
        <Route path="/dm" element={<MainChat />} />
        <Route path="/dm/:username" element={<MainChat />} />
      </Routes>
    </Router>
  )
}

// Main App Component
function App() {
  return <AppRouter />
}
// Create QueryClient instance with optimized settings for avatar caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache avatars for 5 minutes before considering them stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep avatars in cache for 10 minutes after they become unused
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Retry failed requests up to 2 times
      retry: 2,
      // Don't refetch on window focus for avatars (they don't change often)
      refetchOnWindowFocus: false,
    },
  },
})

// App wrapper with QueryClient provider
const AppWithQueryClient = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default AppWithQueryClient
