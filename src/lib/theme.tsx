import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

type Theme = 'system' | 'light' | 'dark'

const LS_KEY = 'theme'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(LS_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'system'
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && getSystemDark())
  document.documentElement.classList.toggle('dark', dark)
}

let listeners: (() => void)[] = []
let currentTheme: Theme = 'system'

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
  if (theme === 'system') {
    localStorage.removeItem(LS_KEY)
  } else {
    localStorage.setItem(LS_KEY, theme)
  }
  applyTheme(theme)
  listeners.forEach((l) => l())
}

// Initialize on first load
if (typeof window !== 'undefined') {
  currentTheme = getStoredTheme()
  applyTheme(currentTheme)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'system') {
      applyTheme('system')
    }
  })
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as Theme)
  const resolvedTheme = theme === 'system' ? (getSystemDark() ? 'dark' : 'light') : theme

  const setTheme = useCallback((t: Theme) => {
    setThemeValue(t)
  }, [])

  return { theme, setTheme, resolvedTheme }
}

const CYCLE: Theme[] = ['system', 'light', 'dark']

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const cycle = () => {
    const idx = CYCLE.indexOf(theme)
    setTheme(CYCLE[(idx + 1) % CYCLE.length])
  }

  if (!mounted) return null

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      onClick={cycle}
      className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-surface-alt/80 backdrop-blur-sm border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
