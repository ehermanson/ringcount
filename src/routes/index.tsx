import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { LeagueLogo } from '../lib/league-logo'

const LS_KEY = 'ring-count-selections'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const PRESETS = [
  {
    name: 'Boston Dynasty Kid',
    emoji: '🍀',
    dob: '2000-01-01',
    teams: '22,36,64,94',
    description: '13 titles since birth',
    color: 'from-green-800 to-emerald-500',
  },
  {
    name: 'Bay Area Golden Age',
    emoji: '🌉',
    dob: '1978-06-15',
    teams: '28,56,72',
    description: '49ers + Giants + Warriors',
    color: 'from-red-600 to-amber-500',
  },
  {
    name: 'Sad Buffalo Fan',
    emoji: '😭',
    dob: '1960-01-01',
    teams: '4,95',
    losses: true,
    description: '0 titles, 6 heartbreaks',
    color: 'from-blue-800 to-red-700',
  },
  {
    name: 'Luckiest Fan Alive',
    emoji: '👑',
    dob: '1950-01-01',
    teams: '22,51,64,107,167,226',
    description: '79 championships, 1 per league',
    color: 'from-amber-500 to-yellow-400',
  },
]

const LEAGUES = [
  { key: 'NFL', label: 'NFL', color: 'bg-nfl' },
  { key: 'MLB', label: 'MLB', color: 'bg-mlb' },
  { key: 'NBA', label: 'NBA', color: 'bg-nba' },
  { key: 'NHL', label: 'NHL', color: 'bg-nhl' },
  { key: 'CFB', label: 'CFB', color: 'bg-cfb' },
  { key: 'CBB', label: 'CBB', color: 'bg-cbb' },
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    if (value === 0) {
      setDisplay(0)
      prevValue.current = 0
      return
    }

    const from = prevValue.current
    const to = value
    prevValue.current = value
    const duration = 1200
    const start = performance.now()

    let raf: number
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.floor(from + (to - from) * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <>{display.toLocaleString()}</>
}

const ITEM_HEIGHT = 48

function ScrollPicker({
  value,
  onChange,
  min,
  max,
  pad,
  label,
  highlight,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  pad: number
  label: string
  highlight?: boolean
}) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ startY: 0, startVal: 0, dragging: false })
  const wheelAccum = useRef(0)

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      wheelAccum.current += e.deltaY
      const threshold = 50
      if (Math.abs(wheelAccum.current) < threshold) return
      const steps = Math.trunc(wheelAccum.current / threshold)
      wheelAccum.current -= steps * threshold
      if (value === 0) {
        onChange(steps > 0 ? min : max)
      } else {
        onChange(clamp(value + steps))
      }
    },
    [value, onChange, min, max, clamp],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragRef.current = { startY: e.touches[0].clientY, startVal: value || min, dragging: true }
    },
    [value, min],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragRef.current.dragging) return
      const dy = dragRef.current.startY - e.touches[0].clientY
      const steps = Math.round(dy / (ITEM_HEIGHT / 2))
      if (steps !== 0) {
        onChange(clamp(dragRef.current.startVal + steps))
      }
    },
    [onChange, clamp],
  )

  const handleTouchEnd = useCallback(() => {
    dragRef.current.dragging = false
  }, [])

  const offset = value === 0 ? 0 : -(value - min) * ITEM_HEIGHT

  return (
    <div className="flex flex-col items-center">
      <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-widest">
        {label}
      </label>
      <div
        className={`relative rounded-xl border-2 bg-white transition-all duration-200 overflow-hidden group ${
          highlight
            ? 'border-nba/40 shadow-lg shadow-nba/10'
            : value
              ? 'border-nba/40'
              : 'border-border'
        }`}
        style={{ width: pad >= 4 ? 120 : 88, height: ITEM_HEIGHT * 3 }}
      >
        {/* Up chevron */}
        <button
          type="button"
          onClick={() => onChange(clamp(value === 0 ? max : value - 1))}
          className="absolute top-0 left-0 right-0 z-20 flex justify-center py-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronUp size={18} />
        </button>

        <div
          ref={containerRef}
          className="scroll-picker-mask h-full select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {value === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-border font-light text-2xl">{pad >= 4 ? 'YYYY' : 'DD'}</span>
            </div>
          ) : (
            <div
              className="transition-transform duration-300 ease-out"
              style={{ transform: `translateY(${offset + ITEM_HEIGHT}px)` }}
            >
              {items.map((n) => (
                <div
                  key={n}
                  className={`flex items-center justify-center font-black text-3xl tabular-nums ${
                    n === value ? 'text-text' : 'text-text/20'
                  }`}
                  style={{ height: ITEM_HEIGHT }}
                >
                  {String(n).padStart(pad, '0')}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Down chevron */}
        <button
          type="button"
          onClick={() => onChange(clamp(value === 0 ? min : value + 1))}
          className="absolute bottom-0 left-0 right-0 z-20 flex justify-center py-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronDown size={18} />
        </button>
      </div>
    </div>
  )
}

function LandingPage() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const [month, setMonth] = useState(0)
  const [day, setDay] = useState(0)
  const [year, setYear] = useState(0)
  const [error, setError] = useState('')
  const [bouncing, setBouncing] = useState<string | null>(null)
  const [dayHighlight, setDayHighlight] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const { dob: savedDob } = JSON.parse(saved)
        if (savedDob) {
          const [y, m, d] = savedDob.split('-')
          setYear(parseInt(y))
          setMonth(parseInt(m))
          setDay(parseInt(d))
        }
      }
    } catch {}
  }, [])

  const triggerBounce = (field: string) => {
    setBouncing(field)
    setTimeout(() => setBouncing(null), 400)
  }

  const handleMonthSelect = (m: number) => {
    setMonth(m)
    setError('')
    triggerBounce('month')
    // Highlight day picker after month selection
    setDayHighlight(true)
    setTimeout(() => setDayHighlight(false), 1500)
  }

  const isComplete = month > 0 && day > 0 && year >= 1920
  const dob = isComplete
    ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : ''

  const daysAlive = (() => {
    if (!isComplete) return 0
    const date = new Date(`${dob}T00:00:00`)
    if (isNaN(date.getTime())) return 0
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 0) return 0
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  })()

  const handleSubmit = () => {
    setError('')
    if (!isComplete) {
      setError('Please fill in your full birthday')
      return
    }

    const date = new Date(`${dob}T00:00:00`)
    const now = new Date()
    if (date > now) {
      setError("You haven't been born yet!")
      return
    }

    navigate({ to: '/select', search: { dob } })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="mb-10">
          <span className="text-7xl block mb-4" role="img" aria-label="Trophy">
            🏆
          </span>
          <h1 className="text-5xl font-black tracking-tight mb-3">
            Ring
            <br />
            <span className="bg-gradient-to-r from-nfl via-nba to-cfb bg-clip-text text-transparent">
              Count
            </span>
          </h1>
          <p className="text-text-muted text-lg">
            Every championship your teams have won in your lifetime
          </p>
        </div>

        <div className="space-y-8">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            When were you born?
          </p>

          {/* Month grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => handleMonthSelect(i + 1)}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
                  ${
                    month === i + 1
                      ? 'bg-gradient-to-br from-nba to-nfl text-white shadow-lg shadow-nba/25'
                      : 'bg-white border border-border text-text-muted hover:border-nba/30 hover:text-text hover:shadow-sm'
                  }
                  ${bouncing === 'month' && month === i + 1 ? 'animate-pop' : ''}`}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Day + Year pickers */}
          <div
            className={`flex gap-4 justify-center transition-all duration-500 ${month > 0 ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-3 pointer-events-none'}`}
          >
            <ScrollPicker
              value={day}
              onChange={(v) => {
                setDay(v)
                setError('')
              }}
              min={1}
              max={31}
              pad={2}
              label="Day"
              highlight={dayHighlight}
            />
            <ScrollPicker
              value={year}
              onChange={(v) => {
                setYear(v)
                setError('')
              }}
              min={1920}
              max={currentYear}
              pad={4}
              label="Year"
            />
          </div>

          {/* Days alive counter */}
          {isComplete && daysAlive > 0 && (
            <p className="text-text-muted animate-fade-up">
              That&apos;s{' '}
              <span className="font-black text-text text-xl tabular-nums">
                <AnimatedCounter value={daysAlive} />
              </span>{' '}
              days of chasing rings
            </p>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          {/* Submit */}
          <div
            className={`transition-all duration-500 ${
              isComplete && daysAlive > 0
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-nfl via-nba to-cfb text-white font-bold text-lg hover:shadow-lg hover:shadow-nba/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              Pick Your Teams
            </button>
          </div>
        </div>

        {/* Preset badges */}
        <div className="mt-10">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
            or try one of these presets
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  navigate({
                    to: '/timeline',
                    search: {
                      dob: preset.dob,
                      teams: preset.teams,
                      losses: preset.losses || undefined,
                    },
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${preset.color} text-white text-xs font-semibold hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer`}
              >
                <span>{preset.emoji}</span>
                <span>
                  {preset.name} (born {preset.dob.slice(0, 4)})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {LEAGUES.map((league) => (
            <div key={league.key} className="flex flex-col items-center gap-1.5">
              <LeagueLogo
                league={league.key}
                className={`w-8 h-8 text-${league.key.toLowerCase()}`}
              />
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                {league.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
