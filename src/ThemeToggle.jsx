import { useState, useEffect } from 'react'

const ThemeToggle = () => {
  const [theme, setTheme] = useState('lumi') // Default to Lumi theme

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

  // Handle theme change
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    
    try {
      localStorage.setItem('chatapp-theme', newTheme)
    } catch (error) {
      console.warn('Failed to save theme preference:', error)
    }
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
    }
  ]

  return (
    <div className="theme-toggle">
      <button 
        className="theme-toggle-btn"
        onClick={() => {
          const dropdown = document.querySelector('.theme-dropdown')
          dropdown.classList.toggle('show')
        }}
        title="Change theme"
      >
        {themes.find(t => t.id === theme)?.name || '🌟 Lumi'}
      </button>
      
      <div className="theme-dropdown">
        <div className="theme-dropdown-header">
          <h4>🎨 Choose Theme</h4>
          <p>Addresses Issues #4, #22, #27</p>
        </div>
        
        {themes.map((themeOption) => (
          <button
            key={themeOption.id}
            className={`theme-option ${theme === themeOption.id ? 'active' : ''}`}
            onClick={() => {
              handleThemeChange(themeOption.id)
              document.querySelector('.theme-dropdown').classList.remove('show')
            }}
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
