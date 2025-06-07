import { useState, useEffect, useRef } from 'react'

const ThemeToggle = () => {
  const [theme, setTheme] = useState('lumi') // Default to Lumi theme
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Load saved theme from localStorage on component mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('chatapp-theme')
      if (savedTheme) {
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)
      } else {
        // Default to Lumi theme
        document.documentElement.setAttribute('data-theme', 'lumi')
      }
    } catch (error) {
      console.warn('Failed to load saved theme:', error)
    }
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Handle theme change
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)

    try {
      localStorage.setItem('chatapp-theme', newTheme)
    } catch (error) {
      console.warn('Failed to save theme preference:', error)
    }

    setIsDropdownOpen(false)
  }

  const themes = [
    {
      id: 'lumi',
      name: '🌟 Lumi',
      description: 'Warm, soft light (Default)',
      colors: ['#FFE082', '#FFCC02', '#FFA500']
    },
    {
      id: 'dark',
      name: '🌙 Dark',
      description: 'Easy on the eyes',
      colors: ['#1a1a1a', '#2d3748', '#4a5568']
    },
    {
      id: 'galaxy',
      name: '🌌 Galaxy',
      description: '@bowo\'s starry night',
      colors: ['#0f0f23', '#533483', '#fbbf24']
    },
    {
      id: 'ocean',
      name: '🌊 Ocean',
      description: 'Cool blue vibes',
      colors: ['#667eea', '#0ea5e9', '#0284c7']
    },
    {
      id: 'purple',
      name: '💜 Purple',
      description: '@boingo\'s elegant request',
      colors: ['#8b5cf6', '#7c3aed', '#581c87']
    }
  ]

  return (
    <div className="theme-toggle" ref={dropdownRef}>
      <button
        className="theme-toggle-btn"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsDropdownOpen(false)
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsDropdownOpen(!isDropdownOpen)
          }
        }}
        title="Change theme"
        aria-expanded={isDropdownOpen}
        aria-haspopup="menu"
        aria-label="Choose theme"
      >
        {themes.find(t => t.id === theme)?.name || '🌟 Lumi'}
      </button>

      <div className={`theme-dropdown ${isDropdownOpen ? 'show' : ''}`}>
        <div className="theme-dropdown-header">
          <h4>🎨 Choose Theme</h4>
        </div>

        {themes.map((themeOption) => (
          <button
            key={themeOption.id}
            className={`theme-option ${theme === themeOption.id ? 'active' : ''}`}
            onClick={() => handleThemeChange(themeOption.id)}
            role="menuitem"
            aria-label={`Switch to ${themeOption.name} theme`}
          >
            <div className="theme-info">
              <div className="theme-name">{themeOption.name}</div>
              <div className="theme-description">{themeOption.description}</div>
            </div>
            <div className="theme-preview">
              {themeOption.colors.map((color, index) => (
                <div
                  key={index}
                  className="theme-color-dot"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        ))}

        <div className="theme-dropdown-footer">
          <small>✨ More themes coming soon!</small>
        </div>
      </div>
    </div>
  )
}

export default ThemeToggle
