import React, { useState, useEffect } from 'react'
import DMChat from './DMChat'

const DMConversation = ({
  username,
  targetUsername,
  onBack,
  soundSettings,
  playMessageSound
}) => {
  const [conversationId, setConversationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Find or create conversation with the target user
  useEffect(() => {
    const findOrCreateConversation = async () => {
      if (!username || !targetUsername) return

      try {
        setLoading(true)
        setError(null)

        // First, try to get existing conversations to find this one
        const conversationsResponse = await fetch(
          `/.netlify/functions/direct-messages?username=${encodeURIComponent(username)}`
        )

        if (conversationsResponse.ok) {
          const conversations = await conversationsResponse.json()
          const existingConversation = conversations.find(
            conv => conv.other_username && conv.other_username.toLowerCase() === targetUsername.toLowerCase()
          )

          if (existingConversation) {
            setConversationId(existingConversation.id)
            setLoading(false)
            return
          }
        }

        // If no existing conversation, create an empty one
        const createResponse = await fetch('/.netlify/functions/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            recipientUsername: targetUsername
          }),
        })

        if (!createResponse.ok) {
          throw new Error(`Failed to create conversation: ${createResponse.status}`)
        }

        const result = await createResponse.json()
        setConversationId(result.conversation_id)

      } catch (err) {
        console.error('Error finding/creating conversation:', err)
        setError('Failed to load conversation')
      } finally {
        setLoading(false)
      }
    }

    findOrCreateConversation()
  }, [username, targetUsername])

  if (loading) {
    return (
      <div className="dm-conversation loading">
        <div className="dm-header">
          <button onClick={onBack} className="back-button">←</button>
          <span>Loading conversation...</span>
        </div>
        <div className="loading-spinner">Finding conversation with {targetUsername}...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dm-conversation error">
        <div className="dm-header">
          <button onClick={onBack} className="back-button">←</button>
          <span>Error</span>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!conversationId) {
    return (
      <div className="dm-conversation error">
        <div className="dm-header">
          <button onClick={onBack} className="back-button">←</button>
          <span>Error</span>
        </div>
        <div className="error-message">
          <p>Could not find or create conversation</p>
          <button onClick={onBack} className="back-button">
            Back to conversations
          </button>
        </div>
      </div>
    )
  }

  return (
    <DMChat
      username={username}
      conversationId={conversationId}
      otherUsername={targetUsername}
      onBack={onBack}
      soundSettings={soundSettings}
      playMessageSound={playMessageSound}
    />
  )
}

export default DMConversation
