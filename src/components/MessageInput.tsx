import React, { useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from 'react'
import { Plus, X } from 'lucide-react'

// Types for better development experience
interface ReplyingTo {
  id: number
  username?: string
  sender_username?: string
  message: string
}

interface User {
  username: string
  status: string
  is_typing?: boolean
  last_message_at?: string
  message_count?: number
}

interface MessageInputProps {
  // Core props
  message: string
  onMessageChange: (value: string) => void
  onSendMessage: (e: FormEvent) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  
  // Reply functionality
  replyingTo?: ReplyingTo | null
  onCancelReply?: () => void
  
  // Optional features
  showActionsMenu?: boolean
  onToggleActionsMenu?: () => void
  onFileUploadClick?: () => void
  
  // Mentions (optional)
  showMentionsAutocomplete?: boolean
  filteredUsers?: User[]
  selectedMentionIndex?: number
  onMentionSelect?: (user: User) => void
  
  // Auto-resize (optional)
  enableAutoResize?: boolean
  
  // Refs
  inputRef?: React.RefObject<HTMLTextAreaElement> | null
  fileInputRef?: React.RefObject<HTMLInputElement> | null
  
  // Additional handlers
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}

const MessageInput: React.FC<MessageInputProps> = ({
  // Core props
  message,
  onMessageChange,
  onSendMessage,
  placeholder = "Type your message... (Shift+Enter for line breaks)",
  disabled = false,
  maxLength = 1000,
  
  // Reply functionality
  replyingTo = null,
  onCancelReply = null,
  
  // Optional features
  showActionsMenu = false,
  onToggleActionsMenu = null,
  onFileUploadClick = null,
  
  // Mentions (optional)
  showMentionsAutocomplete = false,
  filteredUsers = [],
  selectedMentionIndex = 0,
  onMentionSelect = null,
  
  // Auto-resize (optional)
  enableAutoResize = true,
  
  // Refs
  inputRef = null,
  fileInputRef = null,
  
  // Additional handlers
  onKeyDown = null
}) => {
  const [submitting, setSubmitting] = useState(false)
  const defaultInputRef = useRef<HTMLTextAreaElement>(null)
  const actualInputRef = inputRef || defaultInputRef

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim() || submitting || disabled) return
    
    setSubmitting(true)
    onSendMessage(e)
    
    // Reset submitting state after a short delay
    setTimeout(() => setSubmitting(false), 100)
  }

  // Handle input changes with auto-resize
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    onMessageChange(value)

    // Discord-style auto-resize: only expand if content has line breaks or overflows
    if (enableAutoResize && actualInputRef.current) {
      const textarea = actualInputRef.current
      
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
    }
  }

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Call custom onKeyDown handler if provided
    if (onKeyDown) {
      onKeyDown(e)
    }

    // Default Enter key behavior: Enter without Shift = send message
    if (e.key === 'Enter' && !e.shiftKey && !showMentionsAutocomplete) {
      e.preventDefault()
      handleSubmit(e)
    }
    // Shift+Enter = line break (default textarea behavior, no need to handle)
  }

  // Focus management
  useEffect(() => {
    if (actualInputRef.current && !submitting) {
      // Maintain focus after operations
      const timeoutId = setTimeout(() => {
        actualInputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [submitting])

  const replyUsername = replyingTo?.username || replyingTo?.sender_username || 'Unknown'
  const replyMessage = replyingTo?.message || ''

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Reply indicator with Tailwind */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 border-l-4 border-lumi-gold px-4 py-2 mb-2 rounded-r-md">
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
            Replying to <span className="font-medium text-lumi-warm">{replyUsername}</span>: {replyMessage.substring(0, 50)}...
          </span>
          {onCancelReply && (
            <button 
              type="button"
              onClick={onCancelReply} 
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Cancel reply"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        {/* Actions menu button with Tailwind */}
        {showActionsMenu !== false && onToggleActionsMenu && (
          <div className="relative">
            <button
              type="button"
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
                showActionsMenu 
                  ? 'bg-lumi-gold text-white shadow-lg' 
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
              } ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              onClick={onToggleActionsMenu}
              disabled={submitting}
              aria-label="Open actions menu"
              title="Upload files and more"
            >
              <Plus size={20} />
            </button>
          </div>
        )}

        {/* Message input with Tailwind */}
        <div className="flex-1 relative">
          <textarea
            ref={actualInputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || submitting}
            maxLength={maxLength}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            rows={1}
            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-lumi-gold focus:border-transparent ${
              disabled || submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ 
              height: enableAutoResize ? 'auto' : '50px',
              minHeight: '50px',
              maxHeight: '120px'
            }}
          />
        </div>

        {/* Send button with Tailwind */}
        <button
          type="submit"
          disabled={!message.trim() || submitting || disabled}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${
            !message.trim() || submitting || disabled
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-lumi-gold hover:bg-lumi-warm text-white shadow-lg hover:scale-105'
          }`}
          aria-label={submitting ? 'Sending message...' : 'Send message'}
          title={submitting ? 'Sending...' : 'Send'}
        >
          <span className="text-lg font-bold">
            {submitting ? '...' : '→'}
          </span>
        </button>
      </div>
    </form>
  )
}

export default MessageInput
