import { useState, useRef } from 'react'

const ImageUpload = ({ onImageSelect, disabled = false }) => {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP, GIF)')
      return
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size too large. Maximum size is 10MB.')
      return
    }

    onImageSelect(file)
  }

  const handleInputChange = (event) => {
    const file = event.target.files[0]
    handleFileSelect(file)
    // Reset input so same file can be selected again
    event.target.value = ''
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragOver(false)
    
    const files = event.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleButtonClick = () => {
    if (disabled || uploading) return
    fileInputRef.current?.click()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />
      <button
        type="button"
        className={`image-upload-btn ${dragOver ? 'drag-over' : ''} ${disabled || uploading ? 'disabled' : ''}`}
        onClick={handleButtonClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled || uploading}
        title={uploading ? 'Uploading...' : 'Upload image (JPG, PNG, WebP, GIF - max 10MB)'}
        aria-label={uploading ? 'Uploading image...' : 'Upload image'}
      >
        {uploading ? '⏳' : '🖼️'}
      </button>
    </>
  )
}

export default ImageUpload
