import React, { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import ActionsMenu from './ActionsMenu'
import MentionsAutocomplete from './MentionsAutocomplete'
import ImageUpload from './ImageUpload'

const MessageInput = ({
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
  const defaultInputRef = useRef(null)
  const actualInputRef = inputRef || defaultInputRef

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() || submitting) return

    try {
      setSubmitting(true)
      await onSendMessage(e)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle input change with optional auto-resize
  const handleInputChange = (e) => {
    const value = e.target.value
    onMessageChange(value)

    if (enableAutoResize) {
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
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Call custom onKeyDown handler first if provided
    if (onKeyDown) {
      const result = onKeyDown(e)
      // If custom handler returns false, don't continue with default behavior
      if (result === false) return
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

  return (
    <form onSubmit={handleSubmit} className="message-form">
      {/* Reply indicator */}
      {replyingTo && (
        <div className="reply-indicator">
          <span>
            Replying to {replyingTo.username || replyingTo.sender_username}: {
              (replyingTo.message || '').substring(0, 50)
            }...
          </span>
          {onCancelReply && (
            <button type="button" onClick={onCancelReply} className="cancel-reply">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="input-group">
        {/* Actions menu (optional) */}
        {showActionsMenu !== false && onToggleActionsMenu && (
          <div className="actions-button-container">
            <button
              type="button"
              className={`actions-button ${showActionsMenu ? 'active' : ''}`}
              onClick={onToggleActionsMenu}
              disabled={submitting}
              aria-label="Open actions menu"
              title="Upload files and more"
            >
              <Plus size={20} />
            </button>
            
            {onFileUploadClick && (
              <ActionsMenu
                showActionsMenu={showActionsMenu}
                onFileUploadClick={onFileUploadClick}
              />
            )}

            {/* Mentions autocomplete (optional) */}
            {showMentionsAutocomplete && onMentionSelect && (
              <MentionsAutocomplete
                show={showMentionsAutocomplete}
                users={filteredUsers}
                selectedIndex={selectedMentionIndex}
                onSelect={onMentionSelect}
                position={{ bottom: '60px', left: '60px' }}
              />
            )}

            {/* Hidden file input for upload functionality */}
            {fileInputRef && onFileUploadClick && (
              <ImageUpload
                ref={fileInputRef}
                onImageSelect={onFileUploadClick}
                disabled={submitting}
              />
            )}
          </div>
        )}

        {/* Message textarea */}
        <textarea
          ref={actualInputRef}
          className="message-input"
          placeholder={placeholder}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || submitting}
          maxLength={maxLength}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          rows={1}
          style={{ resize: 'none', overflow: 'hidden' }}
        />

        {/* Send button */}
        <button
          type="submit"
          className="send-btn"
          disabled={submitting || !message.trim()}
          aria-label={submitting ? 'Sending message...' : 'Send message'}
          title={submitting ? 'Sending...' : 'Send'}
        >
          {submitting ? '...' : '→'}
        </button>
      </div>
    </form>
  )
}

export default MessageInput
