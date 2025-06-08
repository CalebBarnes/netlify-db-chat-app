import React from 'react'
import { User } from 'lucide-react'
import { useUserAvatar } from './hooks/useUserAvatar'

const Avatar = ({
  username,
  size = 32,
  className = '',
  showFallback = true,
  onClick = null
}) => {
  // Use React Query hook for avatar data with automatic caching and deduplication
  const { data: avatarData, isLoading: loading, isError: error } = useUserAvatar(username)

  // Extract avatar URL from query data
  const avatarUrl = avatarData?.avatarUrl || null

  // Handle image load error (fallback to initials/icon)
  const handleImageError = () => {
    // React Query will handle retries automatically
    // This just triggers fallback display
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
    // Use the same avatarStyle as other states to ensure consistent sizing
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
