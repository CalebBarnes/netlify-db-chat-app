import React, { useState, useRef } from 'react'
import { Upload, User, X, Check } from 'lucide-react'

const AvatarUpload = ({ username, currentAvatarUrl, onAvatarUpdate, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please select a JPG, PNG, or WebP image.')
      return
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 2MB.')
      return
    }

    setError('')
    setSuccess('')
    setSelectedFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Handle avatar upload
  const handleUpload = async () => {
    if (!selectedFile || !username) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1] // Remove data:image/...;base64, prefix

          const response = await fetch('/.netlify/functions/upload-avatar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: username,
              filename: selectedFile.name,
              fileData: base64Data,
            }),
          })

          const result = await response.json()

          if (response.ok) {
            setSuccess('Avatar uploaded successfully!')
            setSelectedFile(null)
            setPreviewUrl(null)
            
            // Reset file input
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }

            // Notify parent component
            if (onAvatarUpdate) {
              onAvatarUpdate(result.avatarUrl)
            }

            // Close modal after short delay
            setTimeout(() => {
              onClose()
            }, 1500)
          } else {
            setError(result.error || 'Failed to upload avatar')
          }
        } catch (uploadError) {
          console.error('Upload error:', uploadError)
          setError('Failed to upload avatar. Please try again.')
        } finally {
          setUploading(false)
        }
      }

      reader.readAsDataURL(selectedFile)
    } catch (error) {
      console.error('File reading error:', error)
      setError('Failed to process file. Please try again.')
      setUploading(false)
    }
  }

  // Handle removing current avatar
  const handleRemoveAvatar = async () => {
    if (!username || !currentAvatarUrl) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/.netlify/functions/user-avatar?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok) {
        setSuccess('Avatar removed successfully!')
        
        // Notify parent component
        if (onAvatarUpdate) {
          onAvatarUpdate(null)
        }

        // Close modal after short delay
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setError(result.error || 'Failed to remove avatar')
      }
    } catch (error) {
      console.error('Remove avatar error:', error)
      setError('Failed to remove avatar. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="avatar-upload-modal">
      <div className="avatar-upload-content">
        <div className="avatar-upload-header">
          <h3>Upload Avatar</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            disabled={uploading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="avatar-upload-body">
          {/* Current Avatar Display */}
          <div className="current-avatar-section">
            <h4>Current Avatar</h4>
            <div className="avatar-preview">
              {currentAvatarUrl ? (
                <img src={currentAvatarUrl} alt="Current avatar" className="avatar-image" />
              ) : (
                <div className="avatar-placeholder">
                  <User size={40} />
                </div>
              )}
            </div>
            {currentAvatarUrl && (
              <button 
                className="remove-avatar-button"
                onClick={handleRemoveAvatar}
                disabled={uploading}
              >
                Remove Current Avatar
              </button>
            )}
          </div>

          {/* File Upload Section */}
          <div className="upload-section">
            <h4>Upload New Avatar</h4>
            
            <div className="file-input-container">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="file-input"
                disabled={uploading}
              />
              <button 
                className="file-select-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} />
                Choose Image
              </button>
            </div>

            {/* Preview */}
            {previewUrl && (
              <div className="preview-section">
                <h5>Preview</h5>
                <div className="avatar-preview">
                  <img src={previewUrl} alt="Avatar preview" className="avatar-image" />
                </div>
                <button 
                  className="upload-button"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Avatar'}
                </button>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                <Check size={16} />
                {success}
              </div>
            )}

            {/* Upload Guidelines */}
            <div className="upload-guidelines">
              <h5>Guidelines</h5>
              <ul>
                <li>Supported formats: JPG, PNG, WebP</li>
                <li>Maximum file size: 2MB</li>
                <li>Recommended size: 128x128 pixels or larger</li>
                <li>Square images work best</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvatarUpload
