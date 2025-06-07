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

  // 🚨 DISCORD UX OVERHAUL - LUMI BRAND ONLY as per @brendo's critical feedback
  // Removed all other themes to focus on legibility and professional Discord-style design
  const themes = [
    {
      id: 'lumi',
      name: 'Lumi Brand',
      description: 'Professional Discord-style design with warm golden light',
      colors: ['#FFE082', '#FFCC02', '#FFA500']
    }
  ]

  // Since we only have Lumi Brand theme now, show a simple theme indicator
  return (
    <div className="theme-indicator">
      <div className="theme-badge" title="Current theme: Lumi Brand - Professional Discord-style design">
        <span className="theme-name">🌟 Lumi Brand</span>
        <div className="theme-preview">
          {themes[0].colors.map((color, index) => (
            <div
              key={index}
              className="theme-color-dot"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ThemeToggle
