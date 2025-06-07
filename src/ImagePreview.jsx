import { useState, useEffect } from 'react'

const ImagePreview = ({ file, onCancel, onSend, message, setMessage, disabled = false }) => {
  const [imageUrl, setImageUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setImageUrl(url)
      
      // Cleanup URL when component unmounts
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  const handleSend = async () => {
    if (!file || uploading) return
    
    setUploading(true)
    try {
      await onSend(file, message)
    } catch (error) {
      console.error('Error sending image:', error)
      alert('Failed to send image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    if (uploading) return
    onCancel()
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!file || !imageUrl) return null

  return (
    <div className="image-preview-container">
      <div className="image-preview">
        <div className="image-preview-header">
          <span className="image-preview-title">📷 Image Preview</span>
          <button
            type="button"
            className="image-preview-close"
            onClick={handleCancel}
            disabled={uploading}
            aria-label="Cancel image upload"
            title="Cancel"
          >
            ✕
          </button>
        </div>
        
        <div className="image-preview-content">
          <img
            src={imageUrl}
            alt="Preview"
            className="preview-image"
          />
          
          <div className="image-info">
            <div className="image-filename">{file.name}</div>
            <div className="image-size">{formatFileSize(file.size)}</div>
          </div>
          
          <div className="image-message-input">
            <input
              type="text"
              placeholder="Add a message (optional)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={uploading}
              maxLength={1000}
              className="image-message-text"
            />
          </div>
          
          <div className="image-preview-actions">
            <button
              type="button"
              className="image-cancel-btn"
              onClick={handleCancel}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="image-send-btn"
              onClick={handleSend}
              disabled={uploading || disabled}
            >
              {uploading ? '⏳ Uploading...' : '📤 Send Image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImagePreview
