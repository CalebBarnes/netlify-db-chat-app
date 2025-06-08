import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DMConversationList from './DMConversationList'
import DMChat from './DMChat'
import NewDMDialog from './NewDMDialog'

const DirectMessages = ({
  username,
  onBack,
  soundSettings,
  playMessageSound,
  targetUser,
  onTargetUserHandled
}) => {
  const navigate = useNavigate()
  const [showNewDMDialog, setShowNewDMDialog] = useState(false)

  // Handle targetUser prop - automatically start conversation with specific user
  useEffect(() => {
    if (targetUser) {
      handleStartConversation(targetUser)
      onTargetUserHandled?.()
    }
  }, [targetUser])

  // Handle conversation selection - navigate to the conversation URL
  const handleSelectConversation = (conversationId, otherUsername) => {
    if (conversationId === 'new') {
      setShowNewDMDialog(true)
    } else {
      // Navigate to the conversation URL
      navigate(`/dm/${encodeURIComponent(otherUsername)}`)
    }
  }

  // Handle starting a new conversation
  const handleStartConversation = async (targetUsername) => {
    try {
      // Send an initial message to create the conversation
      const response = await fetch('/.netlify/functions/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          message: `👋 Hi ${targetUsername}!`,
          recipientUsername: targetUsername
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const newMessage = await response.json()

      // Navigate to the new conversation
      setShowNewDMDialog(false)
      navigate(`/dm/${encodeURIComponent(targetUsername)}`)

    } catch (err) {
      console.error('Error starting conversation:', err)
      alert('Failed to start conversation. Please try again.')
    }
  }

  // Handle canceling new DM dialog
  const handleCancelNewDM = () => {
    setShowNewDMDialog(false)
  }

  return (
    <div className="direct-messages">
      {showNewDMDialog && (
        <NewDMDialog
          username={username}
          onStartConversation={handleStartConversation}
          onCancel={handleCancelNewDM}
        />
      )}

      <div className="dm-main">
        <div className="dm-sidebar">
          <DMConversationList
            username={username}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={null} // Router handles selection now
          />
        </div>

        <div className="dm-welcome">
          <div className="welcome-content">
            <h2>💬 Direct Messages</h2>
            <p>Send private messages to other users</p>

            <div className="welcome-actions">
              <button
                className="start-conversation-button"
                onClick={() => setShowNewDMDialog(true)}
              >
                Start a conversation
              </button>

              <button
                className="back-to-chat-button"
                onClick={onBack}
              >
                Back to main chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectMessages
