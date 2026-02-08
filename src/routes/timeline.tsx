import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getChampionships,
  getChampionshipLosses,
  getTeamsByIds,
  getTeamLogoUrl,
  LEAGUE_LABELS,
  type Championship,
  type Team,
} from '../lib/db'
import { LeagueTrophy } from '../lib/trophies'
import { motion, useInView } from 'motion/react'

type TimelineSearch = {
  dob: string
  teams: string
  losses?: boolean
}

export const Route = createFileRoute('/timeline')({
  validateSearch: (search: Record<string, unknown>): TimelineSearch => ({
    dob: (search.dob as string) || '',
    teams: (search.teams as string) || '',
    losses: search.losses === true || search.losses === 'true' ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ dob: search.dob, teams: search.teams }),
  loader: async ({ deps }) => {
    const teamIds = deps.teams
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0)
    const sinceDate = deps.dob

    const [championships, losses, teams] = await Promise.all([
      getChampionships({ data: { teamIds, sinceDate } }),
      getChampionshipLosses({ data: { teamIds, sinceDate } }),
      getTeamsByIds({ data: { teamIds } }),
    ])
    return { championships, losses, teams }
  },
  component: TimelinePage,
})

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
  )
}

function TimelineItemWrapper({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20, scale: 0.97 }}
      animate={isInView ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -20, scale: 0.97 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

const STREAK_VISIBLE = 5

function StreakTitles({ titles }: { titles: { year: number; league: string; espnId: string }[] }) {
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
            <div className="absolute bottom-full left-0 mb-1.5 p-2 bg-white rounded-xl border border-border shadow-lg z-30 flex flex-wrap gap-1.5 min-w-max">
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

/** Fisheye-style scaling for timeline year groups based on scroll position */
function FisheyeYear({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const raf = useRef(0)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewH = window.innerHeight
    const center = rect.top + rect.height / 2
    const viewCenter = viewH / 2
    // 0 = dead center, 1 = at edge
    const dist = Math.min(Math.abs(center - viewCenter) / (viewH / 2), 1)
    // Ease the curve so the middle ~40% is at full scale
    const eased = Math.max(0, (dist - 0.3) / 0.7)
    setScale(1 - eased * 0.08)
    setOpacity(1 - eased * 0.3)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [update])

  return (
    <div
      ref={ref}
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: 'left center',
        transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
      }}
    >
      {children}
    </div>
  )
}

function TimelineEntry({ championship }: { championship: Championship }) {
  const logoUrl = getTeamLogoUrl(championship.team_league, championship.team_espn_id)

  const hasScore = championship.winning_score != null && championship.losing_score != null

  return (
    <div className="relative pb-3 pl-8">
      {/* Timeline dot — small accent for championship wins */}
      <div
        className="absolute left-0 w-2 h-2 rounded-full z-10 -ml-[4px] mt-5"
        style={{ backgroundColor: championship.team_primary_color }}
      />

      {/* Content card */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex">
          {/* Colored left bar */}
          <div
            className="w-1 flex-shrink-0"
            style={{ backgroundColor: championship.team_primary_color }}
          />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              <img
                src={logoUrl}
                alt={championship.team_name}
                className="w-12 h-12 object-contain flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd" rx="12"/><text x="50" y="55" text-anchor="middle" font-size="32" fill="%23999">?</text></svg>'
                }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">
                  {championship.team_city} {championship.team_name}
                </h3>
                {championship.losing_team_display_name ? (
                  <p className="text-sm mt-0.5">
                    <span className="text-text-muted">def.</span>{' '}
                    <span className="font-medium">{championship.losing_team_display_name}</span>
                    {hasScore && (
                      <span className="font-semibold ml-1">
                        {championship.winning_score}&ndash;{championship.losing_score}
                      </span>
                    )}
                  </p>
                ) : (
                  hasScore && (
                    <p className="text-sm font-semibold mt-0.5">
                      {championship.winning_score}&ndash;{championship.losing_score}
                    </p>
                  )
                )}
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                  <LeagueTrophy league={championship.league} className="w-3.5 h-3.5 inline-block" />
                  {championship.game_title} &middot;{' '}
                  {LEAGUE_LABELS[championship.league] || championship.league}
                  {championship.championship_date && (
                    <span> &middot; {formatDate(championship.championship_date)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineLossEntry({ championship }: { championship: Championship }) {
  const logoUrl = getTeamLogoUrl(championship.team_league, championship.team_espn_id)

  const hasScore = championship.winning_score != null && championship.losing_score != null

  return (
    <div className="relative pb-3 pl-8">
      {/* Timeline dot — small hollow for losses */}
      <div
        className="absolute left-0 w-2 h-2 rounded-full border-[1.5px] bg-white z-10 -ml-[4px] mt-5"
        style={{ borderColor: championship.team_primary_color }}
      />

      {/* Content card */}
      <div className="flex-1 bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow opacity-50">
        <div className="flex">
          {/* Dashed left bar for losses */}
          <div
            className="w-1 flex-shrink-0 opacity-40"
            style={{ backgroundColor: championship.team_primary_color }}
          />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              <img
                src={logoUrl}
                alt={championship.team_name}
                className="w-12 h-12 object-contain flex-shrink-0 grayscale-[50%]"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd" rx="12"/><text x="50" y="55" text-anchor="middle" font-size="32" fill="%23999">?</text></svg>'
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold leading-tight">
                    {championship.team_city} {championship.team_name}
                  </h3>
                  <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                    Loss
                  </span>
                </div>
                <p className="text-sm mt-0.5">
                  <span className="text-text-muted">lost to</span>{' '}
                  <span className="font-medium">{championship.winning_team_display_name}</span>
                  {hasScore && (
                    <span className="font-semibold ml-1">
                      {championship.losing_score}&ndash;{championship.winning_score}
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                  <LeagueTrophy league={championship.league} className="w-3.5 h-3.5 inline-block" />
                  {championship.game_title} &middot;{' '}
                  {LEAGUE_LABELS[championship.league] || championship.league}
                  {championship.championship_date && (
                    <span> &middot; {formatDate(championship.championship_date)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Year the championship was actually played, derived from date when available */
function champYear(c: Championship): number {
  if (c.championship_date) {
    return new Date(c.championship_date + 'T00:00:00').getFullYear()
  }
  return c.year
}

function StatsBar({
  championships,
  birthYear,
}: {
  championships: Championship[]
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

  // Frequency sentiment
  const freqNum = frequency ? parseFloat(frequency) : null
  const sentiment = freqNum
    ? freqNum <= 1.5
      ? 'incredible'
      : freqNum <= 3
        ? 'impressive'
        : freqNum <= 5
          ? 'solid'
          : freqNum <= 8
            ? 'not bad'
            : 'a drought'
    : null

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
        <div className="text-6xl font-black leading-none">{totalTitles}</div>
        <div className="text-white/80 text-sm mt-2">
          {totalTitles === 1 ? 'championship' : 'championships'} in your lifetime
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
    className: 'col-span-2 bg-white rounded-2xl border border-border p-4',
    node: (
      <>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Win Years
        </div>
        <div className="text-2xl font-black mt-1">
          {yearsWithWin}
          <span className="text-base font-normal text-text-muted">/{yearsAlive}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-[3px]">
          {Array.from({ length: yearsAlive }, (_, i) => {
            const year = birthYear + i
            const count = yearWinCounts.get(year) || 0
            const teams = yearChamps.get(year)
            const intensity = count > 0 ? 0.25 + 0.75 * (count / maxWinsInYear) : 0
            return count > 0 ? (
              <div key={year} className="relative group">
                <div
                  className="w-3.5 h-3.5 rounded-sm cursor-pointer"
                  style={{ backgroundColor: `rgba(29, 66, 138, ${intensity})` }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-text text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20">
                  <div className="font-bold">{year}</div>
                  {teams?.map((t, j) => (
                    <div key={j} className="text-white/80">
                      {t.name}
                    </div>
                  ))}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text" />
                </div>
              </div>
            ) : (
              <div
                key={year}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: 'var(--color-surface-alt)' }}
              />
            )
          })}
        </div>
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
      className: 'bg-white rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            By League
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mt-3">
            {leagueBreakdown.map((l) => (
              <div
                key={l.league}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${l.pct}%`, backgroundColor: l.color }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1.5 mt-3">
            {leagueBreakdown.map((l) => (
              <div key={l.league} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-text-muted">{LEAGUE_LABELS[l.league] || l.league}</span>
                </div>
                <span className="font-semibold">{l.count}</span>
              </div>
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
        'row-span-2 bg-white rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Best Year
          </div>
          <div className="text-3xl font-black mt-1">{bestYear.year}</div>
          <div className="flex items-center justify-center gap-2 mt-3">
            {bestYear.teams.map((t, i) => (
              <img
                key={i}
                src={getTeamLogoUrl(t.league, t.espnId)}
                alt=""
                className="w-10 h-10 object-contain"
              />
            ))}
          </div>
          <div className="text-xs text-text-muted mt-2">
            {bestYear.count} {bestYear.count === 1 ? 'title' : 'titles'}
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
        'row-span-2 bg-white rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {isTie ? `MVP Teams` : 'MVP Team'}
          </div>
          <div className="flex items-center justify-center mt-3 gap-3">
            {topTeams.map((t, i) => (
              <img
                key={i}
                src={getTeamLogoUrl(t.league, t.espnId)}
                alt={t.name}
                className={`object-contain ${isTie ? 'w-12 h-12' : 'w-14 h-14'}`}
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
      className: 'bg-white rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Longest Drought
          </div>
          <div className="text-2xl font-black mt-1">
            {drought.years}
            <span className="text-base font-normal text-text-muted"> yrs</span>
            {drought.months > 0 && (
              <>
                {' '}
                {drought.months}
                <span className="text-base font-normal text-text-muted"> mo</span>
              </>
            )}
          </div>
          <div className="mt-3 relative h-2 rounded-full bg-surface-alt overflow-hidden">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-red-300 to-red-500"
              style={{ left: `${droughtStartPct}%`, width: `${droughtWidthPct}%` }}
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
      className: 'bg-white rounded-2xl border border-border p-4',
      node: (
        <>
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Longest Streak
          </div>
          <div className="text-2xl font-black mt-1">
            {longestStreak.years}
            <span className="text-base font-normal text-text-muted"> yrs</span>
            {streakTitles.length > longestStreak.years && (
              <span className="text-xs font-normal text-text-muted ml-1">
                ({streakTitles.length} titles)
              </span>
            )}
          </div>
          <div className="mt-3 relative h-2 rounded-full bg-surface-alt overflow-hidden">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-green-300 to-green-500"
              style={{ left: `${streakStartPct}%`, width: `${streakWidthPct}%` }}
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
        'bg-white rounded-2xl border border-border p-4 flex flex-col items-center justify-center text-center',
      node:
        streakLength >= 2 ? (
          <>
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              Hot Streak
            </div>
            <div className="text-3xl font-black mt-1 text-green-600">{streakLength}</div>
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
                  {sinceLastTitle.years}
                  <span className="text-base font-normal text-text-muted"> yrs</span>
                </div>
                <div className="text-sm font-semibold text-text-muted">
                  {sinceLastTitle.months}
                  <span className="font-normal"> mo</span> {sinceLastTitle.days}
                  <span className="font-normal"> days</span>
                </div>
              </>
            ) : (
              <div className="text-3xl font-black mt-1">
                {yearsSinceLastWin}
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

type TimelineItem = Championship & { _isLoss?: boolean }

function TimelinePage() {
  const { championships, losses, teams } = Route.useLoaderData() as {
    championships: Championship[]
    losses: Championship[]
    teams: Team[]
  }
  const { dob, losses: lossesParam } = Route.useSearch()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const showLosses = !!lossesParam

  const setShowLosses = (val: boolean) => {
    navigate({
      to: '/timeline',
      search: (prev) => ({ ...prev, losses: val || undefined }),
      replace: true,
    })
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Merge wins and (optionally) losses, grouped by year
  const allItems: TimelineItem[] = [
    ...championships.map((c) => ({ ...c, _isLoss: false })),
    ...(showLosses ? losses.map((c) => ({ ...c, _isLoss: true })) : []),
  ]

  const byYear = new Map<number, TimelineItem[]>()
  for (const c of allItems) {
    const cy = champYear(c)
    if (!byYear.has(cy)) {
      byYear.set(cy, [])
    }
    byYear.get(cy)!.push(c)
  }
  // Sort entries within each year: wins first, then losses
  for (const items of byYear.values()) {
    items.sort((a, b) => (a._isLoss === b._isLoss ? 0 : a._isLoss ? 1 : -1))
  }
  const birthYear = new Date(dob + 'T00:00:00').getFullYear()
  const currentYear = new Date().getFullYear()

  // All years from current back to birth year
  const allYears = Array.from({ length: currentYear - birthYear + 1 }, (_, i) => currentYear - i)

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigate({ to: '/select', search: { dob } })}
              className="text-sm text-text-muted hover:text-text inline-flex items-center gap-1 cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Edit Teams
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="text-sm font-medium text-nba hover:text-nba/80 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
          <h1 className="text-3xl font-bold">Your Championship Timeline</h1>
          <p className="text-text-muted mt-1">
            {championships.length} championship{championships.length !== 1 ? 's' : ''} since{' '}
            {birthYear}
          </p>
          {teams.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {teams.map((team) => (
                <img
                  key={team.id}
                  src={getTeamLogoUrl(team.league, team.espn_id)}
                  alt={`${team.city} ${team.name}`}
                  title={`${team.city} ${team.name}`}
                  className="w-8 h-8 object-contain"
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Stats */}
        {championships.length > 0 && (
          <StatsBar championships={championships} birthYear={birthYear} />
        )}

        {/* Losses toggle */}
        {losses.length > 0 && (
          <div className="flex items-center justify-end mb-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-muted">
              <span>Show championship losses</span>
              <button
                type="button"
                role="switch"
                aria-checked={showLosses}
                onClick={() => setShowLosses(!showLosses)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showLosses ? 'bg-nba' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${showLosses ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                />
              </button>
            </label>
          </div>
        )}

        {/* Empty state */}
        {championships.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🪦</div>
            <h2 className="text-xl font-bold mb-2">Absolutely nothing</h2>
            <p className="text-text-muted mb-2">
              Your teams have won zero championships since {birthYear}.
              <br />
              That&apos;s {currentYear - birthYear} years of loyalty with nothing to show for it.
              {losses.length > 0 && (
                <>
                  <br />
                  Well, except {losses.length} championship{' '}
                  {losses.length === 1 ? 'loss' : 'losses'}. So close, yet so far.
                </>
              )}
            </p>
            <p className="text-text-muted mb-6 text-sm italic">
              Maybe it&apos;s not them, maybe it&apos;s you? Try different teams.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: '/select', search: { dob } })}
              className="py-2.5 px-6 rounded-xl bg-nba text-white font-semibold hover:bg-nba/90 transition-all cursor-pointer"
            >
              Edit Teams
            </button>
          </div>
        )}

        {/* Timeline */}
        {(championships.length > 0 || (showLosses && losses.length > 0)) && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

            {allYears.map((year) => {
              const items = byYear.get(year)
              const hasItems = items && items.length > 0

              return (
                <FisheyeYear key={year}>
                  {hasItems ? (
                    <>
                      {/* Championship year marker */}
                      <TimelineItemWrapper>
                        <div className="relative flex items-center mt-2 mb-3 pl-8">
                          <div className="absolute left-0 -ml-[7px] w-3.5 h-3.5 rounded-full bg-text z-10 ring-[3px] ring-white" />
                          <span className="text-2xl font-black text-text">{year}</span>
                        </div>
                      </TimelineItemWrapper>

                      {items.map((item, i) =>
                        item._isLoss ? (
                          <TimelineItemWrapper key={`loss-${item.id}`} delay={0.06 * (i + 1)}>
                            <TimelineLossEntry championship={item} />
                          </TimelineItemWrapper>
                        ) : (
                          <TimelineItemWrapper key={item.id} delay={0.06 * (i + 1)}>
                            <TimelineEntry championship={item} />
                          </TimelineItemWrapper>
                        ),
                      )}
                    </>
                  ) : (
                    /* Empty year — compact muted marker */
                    <div className="relative flex items-center py-1.5 pl-8">
                      <div className="absolute left-0 -ml-[3px] w-1.5 h-1.5 rounded-full bg-border z-10" />
                      <span className="text-sm text-text-muted/60 font-medium">{year}</span>
                    </div>
                  )}
                </FisheyeYear>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
