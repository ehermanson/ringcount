import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'

type Theme = 'light' | 'dark'

const LS_KEY = 'theme'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(LS_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

let listeners: (() => void)[] = []
let currentTheme: Theme = 'light'

function subscribe(cb: () => void) {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter((l) => l !== cb)
  }
}

function getSnapshot() {
  return currentTheme
}

function setThemeValue(theme: Theme) {
  currentTheme = theme
  localStorage.setItem(LS_KEY, theme)
  applyTheme(theme)
  listeners.forEach((l) => l())
}

// Initialize on first load
if (typeof window !== 'undefined') {
  currentTheme = getStoredTheme()
  localStorage.setItem(LS_KEY, currentTheme)
  applyTheme(currentTheme)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'light' as Theme)

  const setTheme = useCallback((t: Theme) => {
    setThemeValue(t)
  }, [])

  return { theme, setTheme }
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const Icon = theme === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-surface-alt/80 backdrop-blur-sm border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
