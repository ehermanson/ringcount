import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { type Championship, getTeamLogoUrl, LEAGUE_LABELS } from '../db'
import { formatDate, champYear } from './utils'

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
            <span className="text-base font-normal text-text-muted"> yrs in a row</span>
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
