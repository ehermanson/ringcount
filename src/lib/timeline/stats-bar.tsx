import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { motion, useInView } from 'motion/react'
import { type Championship, getTeamLogoUrl, LEAGUE_LABELS } from '../db'
import { formatDate, champYear } from './utils'

const InViewContext = createContext(false)

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const inView = useContext(InViewContext)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return

    let raf: number
    let start: number | null = null
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return <>{display}</>
}

function LeagueBar({
  leagueBreakdown,
}: {
  leagueBreakdown: { league: string; pct: number; color: string }[]
}) {
  const inView = useContext(InViewContext)
  return (
    <div className="flex h-2 rounded-full overflow-hidden mt-3">
      {leagueBreakdown.map((l) => (
        <div
          key={l.league}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{
            width: inView ? `${l.pct}%` : '0%',
            backgroundColor: l.color,
            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      ))}
    </div>
  )
}

function AnimatedLogo({
  src,
  alt,
  className,
  delay = 0,
}: {
  src: string
  alt: string
  className?: string
  delay?: number
}) {
  const inView = useContext(InViewContext)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setAnimate(true), delay * 1000)
    return () => clearTimeout(t)
  }, [inView, delay])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        opacity: animate ? 1 : 0,
        transform: animate ? undefined : 'scale(0.3)',
        animation: animate ? `logo-elastic 0.6s ease-out both` : undefined,
      }}
    />
  )
}

function LeagueRow({
  label,
  color,
  count,
  delay,
}: {
  league: string
  label: string
  color: string
  count: number
  delay: number
}) {
  const inView = useContext(InViewContext)
  return (
    <div
      className="flex items-center justify-between text-xs"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateX(0)' : 'translateX(-12px)',
        transition: `opacity 0.3s ease ${delay}s, transform 0.3s ease ${delay}s`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-text-muted">{label}</span>
      </div>
      <span className="font-semibold">
        <AnimatedNumber value={count} duration={600} />
      </span>
    </div>
  )
}

function AnimatedBar({
  width,
  style,
  className,
}: {
  width: string
  style?: React.CSSProperties
  className?: string
}) {
  const inView = useContext(InViewContext)
  return (
    <div
      className={className}
      style={{
        ...style,
        width: inView ? width : '0%',
        transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    />
  )
}

function HeatmapGrid({
  yearsAlive,
  birthYear,
  yearWinCounts,
  yearChamps,
  maxWinsInYear,
}: {
  yearsAlive: number
  birthYear: number
  yearWinCounts: Map<number, number>
  yearChamps: Map<number, { league: string; espnId: string; name: string }[]>
  maxWinsInYear: number
}) {
  const inView = useContext(InViewContext)
  return (
    <div className="mt-3 flex flex-wrap gap-[3px] overflow-visible">
      {Array.from({ length: yearsAlive }, (_, i) => {
        const year = birthYear + i
        const count = yearWinCounts.get(year) || 0
        const teams = yearChamps.get(year)
        const intensity = count > 0 ? 0.25 + 0.75 * (count / maxWinsInYear) : 0
        return count > 0 ? (
          <div key={year} className="relative group">
            <div
              className="w-3.5 h-3.5 rounded-sm cursor-pointer"
              style={{
                backgroundColor: `rgba(29, 66, 138, ${intensity})`,
                opacity: inView ? 1 : 0,
                transition: `opacity 0.3s ease ${i * 0.02}s`,
              }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-gray-900 text-gray-100 text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 w-max max-w-[200px]">
              <div className="font-bold">{year}</div>
              {teams?.map((t, j) => (
                <div key={j} className="flex items-center gap-1.5 text-gray-300 mt-0.5">
                  <img
                    src={getTeamLogoUrl(t.league, t.espnId)}
                    alt=""
                    className="w-3.5 h-3.5 object-contain flex-shrink-0"
                  />
                  <span className="truncate">{t.name}</span>
                </div>
              ))}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        ) : (
          <div
            key={year}
            className="w-3.5 h-3.5 rounded-sm"
            style={{
              backgroundColor: 'var(--color-border)',
              opacity: inView ? 1 : 0,
              transition: `opacity 0.3s ease ${i * 0.02}s`,
            }}
          />
        )
      })}
    </div>
  )
}

// Stat card entrance variants — each card gets a different personality
const cardVariants = [
  // Slide up + slight rotate
  {
    hidden: { opacity: 0, y: 40, rotate: -2 },
    visible: { opacity: 1, y: 0, rotate: 0 },
  },
  // Scale up from nothing
  {
    hidden: { opacity: 0, scale: 0.7 },
    visible: { opacity: 1, scale: 1 },
  },
  // Slide from left
  {
    hidden: { opacity: 0, x: -50, rotate: 1 },
    visible: { opacity: 1, x: 0, rotate: 0 },
  },
  // Slide from right
  {
    hidden: { opacity: 0, x: 50, rotate: -1 },
    visible: { opacity: 1, x: 0, rotate: 0 },
  },
  // Drop in from above + bounce
  {
    hidden: { opacity: 0, y: -30, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
  // Flip up
  {
    hidden: { opacity: 0, rotateX: 45, y: 20 },
    visible: { opacity: 1, rotateX: 0, y: 0 },
  },
]

function StatCard({
  children,
  index,
  className,
}: {
  children: React.ReactNode
  index: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' })
  const variant = cardVariants[index % cardVariants.length]

  return (
    <InViewContext.Provider value={isInView}>
      <motion.div
        ref={ref}
        className={className}
        initial={variant.hidden}
        animate={isInView ? variant.visible : variant.hidden}
        transition={{
          duration: 0.5,
          delay: index * 0.08,
          ease: [0.34, 1.56, 0.64, 1],
        }}
      >
        {children}
      </motion.div>
    </InViewContext.Provider>
  )
}

const STREAK_VISIBLE = 5

function StreakTitles({ titles }: { titles: { year: number; league: string; espnId: string }[] }) {
  const inView = useContext(InViewContext)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const visible = titles.slice(0, STREAK_VISIBLE)
  const overflow = titles.slice(STREAK_VISIBLE)

  useEffect(() => {
    if (!expanded) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [expanded])

  return (
    <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
      {visible.map((t, i) => (
        <div
          key={i}
          className="flex items-center gap-1 bg-surface-alt rounded-full pl-0.5 pr-2 py-0.5"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.8)',
            transition: `opacity 0.3s ease ${0.4 + i * 0.08}s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.4 + i * 0.08}s`,
          }}
        >
          <img src={getTeamLogoUrl(t.league, t.espnId)} alt="" className="w-4 h-4 object-contain" />
          <span className="text-[11px] font-semibold">{t.year}</span>
        </div>
      ))}
      {overflow.length > 0 && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-semibold text-text-muted bg-surface-alt rounded-full px-2.5 py-0.5 hover:bg-border transition-colors cursor-pointer"
          >
            +{overflow.length} more
          </button>
          {expanded && (
            <div className="absolute bottom-full left-0 mb-1.5 p-2 bg-card rounded-xl border border-border shadow-lg z-30 flex flex-wrap gap-1.5 min-w-max">
              {overflow.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-surface-alt rounded-full pl-0.5 pr-2 py-0.5"
                >
                  <img
                    src={getTeamLogoUrl(t.league, t.espnId)}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                  <span className="text-[11px] font-semibold">{t.year}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StatsBar({
  championships,
  losses,
  birthYear,
}: {
  championships: Championship[]
  losses: Championship[]
  birthYear: number
}) {
  const currentYear = new Date().getFullYear()
  const yearsAlive = currentYear - birthYear

  const totalTitles = championships.length

  // Frequency
  const frequency = totalTitles > 0 ? (yearsAlive / totalTitles).toFixed(1) : null

  // Championship coverage — unique years with at least one title
  const uniqueYears = new Set(championships.map((c) => champYear(c)))
  const yearsWithWin = uniqueYears.size

  // Best year — track which teams won (with logo info + names)
  const yearChamps = new Map<number, { league: string; espnId: string; name: string }[]>()
  for (const c of championships) {
    const cy = champYear(c)
    if (!yearChamps.has(cy)) yearChamps.set(cy, [])
    yearChamps.get(cy)!.push({
      league: c.team_league,
      espnId: c.team_espn_id,
      name: `${c.team_city} ${c.team_name}`,
    })
  }
  let bestYear = {
    year: 0,
    count: 0,
    teams: [] as { league: string; espnId: string; name: string }[],
  }
  for (const [year, teams] of yearChamps) {
    if (teams.length > bestYear.count) {
      bestYear = { year, count: teams.length, teams }
    }
  }

  // Frequency sentiment — factor in both raw count and frequency.
  // Most fans never see more than a handful of titles in a lifetime;
  // double-digit totals are genuinely rare and should be celebrated.
  const freqNum = frequency ? parseFloat(frequency) : null
  const sentiment = (() => {
    const tiers = [
      'legendary',
      'incredible',
      'impressive',
      'solid',
      'not bad',
      'a drought',
    ] as const
    // Raw title count — the single biggest signal of how special a run is
    const countIdx =
      totalTitles >= 15
        ? 0 // legendary
        : totalTitles >= 10
          ? 1 // incredible
          : totalTitles >= 6
            ? 2 // impressive
            : totalTitles >= 3
              ? 3 // solid
              : totalTitles >= 1
                ? 4 // not bad
                : 5
    // Frequency (years per title)
    const freqIdx = freqNum
      ? freqNum <= 1.5
        ? 0
        : freqNum <= 2.5
          ? 1
          : freqNum <= 4
            ? 2
            : freqNum <= 6
              ? 3
              : freqNum <= 10
                ? 4
                : 5
      : 5
    // Use whichever dimension paints the better picture
    return tiers[Math.min(countIdx, freqIdx)]
  })()

  // Longest drought — track the year range and bounding dates
  const sortedYears = Array.from(uniqueYears).sort((a, b) => a - b)

  // Sort all championships by date to find bounding dates
  const sortedByDate = [...championships]
    .filter((c) => c.championship_date)
    .sort((a, b) => a.championship_date!.localeCompare(b.championship_date!))

  // Map from year to the latest championship date in that year
  const latestDateInYear = new Map<number, string>()
  const earliestDateInYear = new Map<number, string>()
  for (const c of sortedByDate) {
    const y = champYear(c)
    if (!earliestDateInYear.has(y)) earliestDateInYear.set(y, c.championship_date!)
    latestDateInYear.set(y, c.championship_date!)
  }

  let drought = { years: 0, months: 0, from: 0, to: 0, fromDate: '', toDate: '' }

  function dateDiffYearsMonths(startStr: string, endStr: string) {
    const s = new Date(startStr + 'T00:00:00')
    const e = new Date(endStr + 'T00:00:00')
    let yrs = e.getFullYear() - s.getFullYear()
    let mos = e.getMonth() - s.getMonth()
    if (e.getDate() < s.getDate()) mos--
    if (mos < 0) {
      yrs--
      mos += 12
    }
    return { years: yrs, months: mos }
  }

  if (sortedYears.length > 1) {
    let longestGap = 0
    for (let i = 1; i < sortedYears.length; i++) {
      const gap = sortedYears[i] - sortedYears[i - 1]
      if (gap > longestGap) {
        longestGap = gap
        const fd = latestDateInYear.get(sortedYears[i - 1]) || ''
        const td = earliestDateInYear.get(sortedYears[i]) || ''
        const diff = fd && td ? dateDiffYearsMonths(fd, td) : { years: gap, months: 0 }
        drought = {
          years: diff.years,
          months: diff.months,
          from: sortedYears[i - 1],
          to: sortedYears[i],
          fromDate: fd,
          toDate: td,
        }
      }
    }
  } else if (sortedYears.length === 1) {
    const before = sortedYears[0] - birthYear
    const after = currentYear - sortedYears[0]
    if (before >= after) {
      drought = {
        years: before,
        months: 0,
        from: birthYear,
        to: sortedYears[0],
        fromDate: '',
        toDate: earliestDateInYear.get(sortedYears[0]) || '',
      }
    } else {
      drought = {
        years: after,
        months: 0,
        from: sortedYears[0],
        to: currentYear,
        fromDate: latestDateInYear.get(sortedYears[0]) || '',
        toDate: '',
      }
    }
  }

  // Longest streak — consecutive years with at least one title
  let longestStreak = { years: 0, from: 0, to: 0 }
  if (sortedYears.length > 0) {
    let runStart = sortedYears[0]
    let runEnd = sortedYears[0]
    for (let i = 1; i < sortedYears.length; i++) {
      if (sortedYears[i] === runEnd + 1) {
        runEnd = sortedYears[i]
      } else {
        const len = runEnd - runStart + 1
        if (len > longestStreak.years) {
          longestStreak = { years: len, from: runStart, to: runEnd }
        }
        runStart = sortedYears[i]
        runEnd = sortedYears[i]
      }
    }
    const len = runEnd - runStart + 1
    if (len > longestStreak.years) {
      longestStreak = { years: len, from: runStart, to: runEnd }
    }
  }

  // Per-year win counts for contribution chart
  const yearWinCounts = new Map<number, number>()
  for (const c of championships) {
    const cy = champYear(c)
    yearWinCounts.set(cy, (yearWinCounts.get(cy) || 0) + 1)
  }
  const maxWinsInYear = Math.max(1, ...yearWinCounts.values())

  // Most decorated team
  const teamWins = new Map<
    string,
    { count: number; league: string; espnId: string; name: string; color: string }
  >()
  for (const c of championships) {
    const key = `${c.team_league}-${c.team_espn_id}`
    const existing = teamWins.get(key)
    if (existing) {
      existing.count++
    } else {
      teamWins.set(key, {
        count: 1,
        league: c.team_league,
        espnId: c.team_espn_id,
        name: `${c.team_city} ${c.team_name}`,
        color: c.team_primary_color,
      })
    }
  }
  const sortedTeamWins = Array.from(teamWins.values()).sort((a, b) => b.count - a.count)
  const topCount = sortedTeamWins[0]?.count || 0
  const topTeams = sortedTeamWins.filter((t) => t.count === topCount)
  const uniqueTeams = teamWins.size

  // Current streak status
  const lastWinYear = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : null
  const yearsSinceLastWin = lastWinYear ? currentYear - lastWinYear : null

  // Precise time since last title
  const lastWinDate =
    sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1].championship_date : null
  const sinceLastTitle = (() => {
    if (!lastWinDate) return null
    const today = new Date()
    const last = new Date(lastWinDate + 'T00:00:00')
    let yrs = today.getFullYear() - last.getFullYear()
    let mos = today.getMonth() - last.getMonth()
    let days = today.getDate() - last.getDate()
    if (days < 0) {
      mos--
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      days += prevMonth.getDate()
    }
    if (mos < 0) {
      yrs--
      mos += 12
    }
    return { years: yrs, months: mos, days }
  })()
  // Check for consecutive years ending at current/last year
  let streakLength = 0
  if (lastWinYear && lastWinYear >= currentYear - 1) {
    for (let y = lastWinYear; y >= birthYear; y--) {
      if (uniqueYears.has(y)) streakLength++
      else break
    }
  }

  // League breakdown
  const leagueCounts = new Map<string, number>()
  for (const c of championships) {
    leagueCounts.set(c.league, (leagueCounts.get(c.league) || 0) + 1)
  }
  const leagueColors: Record<string, string> = {
    NFL: '#22c55e',
    MLB: '#ef4444',
    NBA: '#f97316',
    NHL: '#0ea5e9',
    CFB: '#8b5cf6',
    CBB: '#eab308',
  }
  const leagueBreakdown = Array.from(leagueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([league, count]) => ({
      league,
      count,
      pct: totalTitles > 0 ? (count / totalTitles) * 100 : 0,
      color: leagueColors[league] || '#999',
    }))

  // Build ordered list of cards to render, so we can assign sequential indices
  const cards: { key: string; className: string; node: React.ReactNode }[] = []

  // Hero card
  cards.push({
    key: 'hero',
    className: 'col-span-2 bg-gradient-to-br from-nfl via-nba to-cfb rounded-2xl p-6 text-white',
    node: (
      <>
        <div className="text-6xl font-black leading-none">
          <AnimatedNumber value={totalTitles} duration={1000} />
        </div>
        <div className="text-white/80 text-sm mt-2">
          {totalTitles === 1 ? 'championship' : 'championships'} in your lifetime
          {losses.length > 0 && (
            <span className="text-white/50">
              {' '}
              · {losses.length} {losses.length === 1 ? 'loss' : 'losses'}
            </span>
          )}
        </div>
        {frequency && (
          <div className="mt-4 pt-3 border-t border-white/20 text-sm">
            A title every <span className="font-bold text-white">{frequency} years</span> &mdash;{' '}
            {sentiment}
          </div>
        )}
      </>
    ),
  })

  // Win years — spans 2 cols for the contribution chart
  cards.push({
    key: 'coverage',
    className: 'col-span-2 bg-card rounded-2xl border border-border p-4',
    node: (
      <>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Win Years
        </div>
        <div className="text-2xl font-black mt-1">
          <AnimatedNumber value={yearsWithWin} />
          <span className="text-base font-normal text-text-muted">
            /<AnimatedNumber value={yearsAlive} />
          </span>
        </div>
        <HeatmapGrid
          yearsAlive={yearsAlive}
          birthYear={birthYear}
          yearWinCounts={yearWinCounts}
          yearChamps={yearChamps}
          maxWinsInYear={maxWinsInYear}
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
          <span>{birthYear}</span>
          <span>{currentYear}</span>
        </div>
      </>
    ),
  })

  // League breakdown
  if (leagueBreakdown.length > 1) {
    cards.push({
      key: 'league',
      className: 'bg-card rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            By League
          </div>
          <LeagueBar leagueBreakdown={leagueBreakdown} />
          <div className="flex flex-col gap-1.5 mt-3">
            {leagueBreakdown.map((l, i) => (
              <LeagueRow
                key={l.league}
                league={l.league}
                label={LEAGUE_LABELS[l.league] || l.league}
                color={l.color}
                count={l.count}
                delay={0.3 + i * 0.1}
              />
            ))}
          </div>
        </>
      ),
    })
  }

  // Best year
  if (bestYear.year > 0) {
    cards.push({
      key: 'best-year',
      className:
        'row-span-2 bg-card rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Best Year
          </div>
          <div className="text-3xl font-black mt-1">{bestYear.year}</div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {bestYear.teams.map((t, i) => (
              <AnimatedLogo
                key={i}
                src={getTeamLogoUrl(t.league, t.espnId)}
                alt=""
                className="w-10 h-10 object-contain"
                delay={0.2 + i * 0.15}
              />
            ))}
          </div>
          <div className="text-xs text-text-muted mt-2">
            <AnimatedNumber value={bestYear.count} /> {bestYear.count === 1 ? 'title' : 'titles'}
          </div>
        </>
      ),
    })
  }

  // MVP team(s) — tall card, placed next to Best Year
  if (topTeams.length > 0 && uniqueTeams > 1) {
    const isTie = topTeams.length > 1
    cards.push({
      key: 'mvp',
      className:
        'row-span-2 bg-card rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {isTie ? `MVP Teams` : 'MVP Team'}
          </div>
          <div className="flex items-center justify-center mt-3 gap-3">
            {topTeams.map((t, i) => (
              <AnimatedLogo
                key={i}
                src={getTeamLogoUrl(t.league, t.espnId)}
                alt={t.name}
                className={`object-contain ${isTie ? 'w-12 h-12' : 'w-14 h-14'}`}
                delay={0.3 + i * 0.15}
              />
            ))}
          </div>
          {isTie ? (
            <>
              <div className="font-bold text-sm mt-2 leading-tight">
                {topTeams.map((t) => t.name).join(' & ')}
              </div>
              <div className="text-xs text-text-muted mt-1">{topCount} titles each</div>
            </>
          ) : (
            <>
              <div className="font-bold text-sm mt-2 leading-tight">{topTeams[0].name}</div>
              <div className="text-xs text-text-muted mt-1">
                {topCount} of your {totalTitles} titles
              </div>
            </>
          )}
        </>
      ),
    })
  }

  // Drought
  if (drought.years > 0 || drought.months > 0) {
    const droughtYearSpan = drought.to - drought.from
    const droughtStartPct = yearsAlive > 0 ? ((drought.from - birthYear) / yearsAlive) * 100 : 0
    const droughtWidthPct = yearsAlive > 0 ? (droughtYearSpan / yearsAlive) * 100 : 0
    cards.push({
      key: 'drought',
      className: 'bg-card rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Longest Drought
          </div>
          <div className="text-2xl font-black mt-1">
            <AnimatedNumber value={drought.years} />
            <span className="text-base font-normal text-text-muted"> yrs</span>
            {drought.months > 0 && (
              <>
                {' '}
                <AnimatedNumber value={drought.months} />
                <span className="text-base font-normal text-text-muted"> mo</span>
              </>
            )}
          </div>
          <div className="mt-3 relative h-2 rounded-full bg-border overflow-hidden">
            <AnimatedBar
              width={`${droughtWidthPct}%`}
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-red-400 to-red-500"
              style={{ left: `${droughtStartPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>{birthYear}</span>
            <span>{currentYear}</span>
          </div>
          <div className="text-center text-[11px] text-text-muted mt-3">
            {drought.fromDate ? formatDate(drought.fromDate) : drought.from} &ndash;{' '}
            {drought.toDate ? formatDate(drought.toDate) : drought.to}
          </div>
        </>
      ),
    })
  }

  // Longest streak
  if (longestStreak.years >= 2) {
    const streakStartPct =
      yearsAlive > 0 ? ((longestStreak.from - birthYear) / yearsAlive) * 100 : 0
    const streakWidthPct = yearsAlive > 0 ? (longestStreak.years / yearsAlive) * 100 : 0
    const streakTitles: { year: number; league: string; espnId: string }[] = []
    for (let y = longestStreak.from; y <= longestStreak.to; y++) {
      const teams = yearChamps.get(y)
      if (teams) {
        for (const t of teams) {
          streakTitles.push({ year: y, league: t.league, espnId: t.espnId })
        }
      }
    }
    cards.push({
      key: 'streak',
      className: 'bg-card rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Longest Streak
          </div>
          <div className="text-2xl font-black mt-1">
            <AnimatedNumber value={longestStreak.years} />
            <span className="text-base font-normal text-text-muted"> yrs in a row</span>
            {streakTitles.length > longestStreak.years && (
              <span className="text-xs font-normal text-text-muted ml-1">
                (<AnimatedNumber value={streakTitles.length} /> titles)
              </span>
            )}
          </div>
          <div className="mt-3 relative h-2 rounded-full bg-border overflow-hidden">
            <AnimatedBar
              width={`${streakWidthPct}%`}
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-green-400 to-green-500"
              style={{ left: `${streakStartPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>{birthYear}</span>
            <span>
              {longestStreak.from}&ndash;{longestStreak.to}
            </span>
            <span>{currentYear}</span>
          </div>
          <StreakTitles titles={streakTitles} />
        </>
      ),
    })
  }

  // Current status
  if (lastWinYear) {
    cards.push({
      key: 'status',
      className:
        'bg-card rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node:
        streakLength >= 2 ? (
          <>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              Hot Streak
            </div>
            <div className="text-3xl font-black mt-1 text-green-600">
              <AnimatedNumber value={streakLength} />
            </div>
            <div className="text-xs text-text-muted mt-1">consecutive years with a title</div>
          </>
        ) : yearsSinceLastWin === 0 ? (
          <>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              Status
            </div>
            <div className="text-2xl font-black mt-1">Champs!</div>
            <div className="text-xs text-text-muted mt-1">won a title this year</div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Since Last Title
            </div>
            {sinceLastTitle ? (
              <>
                <div className="text-3xl font-black mt-1">
                  <AnimatedNumber value={sinceLastTitle.years} />
                  <span className="text-base font-normal text-text-muted"> yrs</span>
                </div>
                <div className="text-sm font-semibold text-text-muted">
                  <AnimatedNumber value={sinceLastTitle.months} />
                  <span className="font-normal"> mo</span>{' '}
                  <AnimatedNumber value={sinceLastTitle.days} />
                  <span className="font-normal"> days</span>
                </div>
              </>
            ) : (
              <div className="text-3xl font-black mt-1">
                <AnimatedNumber value={yearsSinceLastWin!} />
                <span className="text-base font-normal text-text-muted"> yrs</span>
              </div>
            )}
            <div className="text-xs text-text-muted mt-1">and counting</div>
          </>
        ),
    })
  }

  return (
    <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <StatCard key={card.key} index={i} className={card.className}>
          {card.node}
        </StatCard>
      ))}
    </div>
  )
}
