import React, { useState, useEffect } from 'react'
import { User } from 'lucide-react'

const Avatar = ({ 
  username, 
  size = 32, 
  className = '', 
  showFallback = true,
  onClick = null 
}) => {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch user avatar
  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }

    const fetchAvatar = async () => {
      try {
        setLoading(true)
        setError(false)

        const response = await fetch(`/.netlify/functions/user-avatar?username=${encodeURIComponent(username)}`)
        const result = await response.json()

        if (response.ok && result.hasAvatar) {
          setAvatarUrl(result.avatar.avatarUrl)
        } else {
          setAvatarUrl(null)
        }
      } catch (err) {
        console.error('Error fetching avatar:', err)
        setError(true)
        setAvatarUrl(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAvatar()
  }, [username])

  // Handle image load error
  const handleImageError = () => {
    setError(true)
    setAvatarUrl(null)
  }

  // Generate initials from username as fallback
  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const avatarStyle = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.max(size * 0.4, 12)}px`,
  }

  const containerClasses = [
    'avatar-container',
    className,
    onClick ? 'clickable' : '',
  ].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div 
        className={`${containerClasses} loading`}
        style={avatarStyle}
        title="Loading avatar..."
      >
        <div className="avatar-loading-spinner" />
      </div>
    )
  }

  if (avatarUrl && !error) {
    return (
      <div 
        className={containerClasses}
        style={avatarStyle}
        onClick={onClick}
        title={username}
      >
        <img
          src={avatarUrl}
          alt={`${username}'s avatar`}
          className="avatar-image"
          onError={handleImageError}
        />
      </div>
    )
  }

  // Fallback to initials or User icon
  if (showFallback) {
    return (
      <div 
        className={`${containerClasses} fallback`}
        style={avatarStyle}
        onClick={onClick}
        title={username}
      >
        {username ? (
          <span className="avatar-initials">
            {getInitials(username)}
          </span>
        ) : (
          <User size={size * 0.6} />
        )}
      </div>
    )
  }

  return null
}

export default Avatar
