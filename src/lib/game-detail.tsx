import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Loader2, RotateCcw } from 'lucide-react'
import { type Championship, getTeamLogoUrl, LEAGUE_LABELS } from './db'

const SERIES_LEAGUES = new Set(['NBA', 'NHL', 'MLB'])

// --- Box Score Types & Parsing ---

interface BoxScoreTeam {
  name: string
  abbreviation: string
  score: number
  periods: number[]
}

interface BoxScorePlayer {
  name: string
  team: string
  stats: string
}

interface BoxScoreData {
  winner: BoxScoreTeam
  loser: BoxScoreTeam
  periodLabel: string
  mvp: BoxScorePlayer
  keyPlayers: BoxScorePlayer[]
  venue?: string
  attendance?: string
}

function parseBoxScore(text: string): {
  boxScore: BoxScoreData | null
  narrativeText: string
} {
  const openFence = '```boxscore\n'
  const closeFence = '\n```'

  const openIdx = text.indexOf(openFence)
  if (openIdx === -1) {
    // No boxscore block at all — return full text as narrative (backwards compat)
    return { boxScore: null, narrativeText: text }
  }

  const jsonStart = openIdx + openFence.length
  const closeIdx = text.indexOf(closeFence, jsonStart)

  if (closeIdx === -1) {
    // Still streaming the JSON block — nothing to show yet
    return { boxScore: null, narrativeText: '' }
  }

  const jsonStr = text.slice(jsonStart, closeIdx)
  const narrativeText = text.slice(closeIdx + closeFence.length).trimStart()

  try {
    const parsed = JSON.parse(jsonStr) as BoxScoreData
    return { boxScore: parsed, narrativeText }
  } catch {
    // Malformed JSON — show everything as narrative
    return { boxScore: null, narrativeText: text }
  }
}

// --- Box Score Component ---

function BoxScore({ data }: { data: BoxScoreData }) {
  const maxPeriods = Math.max(data.winner.periods.length, data.loser.periods.length)
  const isSeries = data.periodLabel === 'Gm'
  const periodHeaders = Array.from({ length: maxPeriods }, (_, i) =>
    data.periodLabel === 'Gm' ? `Gm${i + 1}` : `${data.periodLabel}${i + 1}`,
  )

  return (
    <motion.div
      className="rounded-xl border border-border overflow-hidden mb-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Score Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-alt text-text-muted">
              <th className="text-left py-1.5 px-3 font-medium w-16" />
              {periodHeaders.map((h) => (
                <th key={h} className="py-1.5 px-1.5 font-medium text-center min-w-[28px]">
                  {h}
                </th>
              ))}
              <th className="py-1.5 px-3 font-semibold text-center text-text">
                {isSeries ? 'Series' : 'Final'}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Winner row */}
            <tr className="font-semibold border-b border-border/50">
              <td className="py-1.5 px-3 text-left">{data.winner.abbreviation}</td>
              {data.winner.periods.map((p, i) => (
                <td key={i} className="py-1.5 px-1.5 text-center">
                  {p}
                </td>
              ))}
              {/* Pad if fewer periods */}
              {Array.from({ length: maxPeriods - data.winner.periods.length }).map((_, i) => (
                <td key={`pad-w-${i}`} className="py-1.5 px-1.5 text-center">
                  -
                </td>
              ))}
              <td className="py-1.5 px-3 text-center text-sm font-bold">{data.winner.score}</td>
            </tr>
            {/* Loser row */}
            <tr className="text-text-muted">
              <td className="py-1.5 px-3 text-left">{data.loser.abbreviation}</td>
              {data.loser.periods.map((p, i) => (
                <td key={i} className="py-1.5 px-1.5 text-center">
                  {p}
                </td>
              ))}
              {Array.from({ length: maxPeriods - data.loser.periods.length }).map((_, i) => (
                <td key={`pad-l-${i}`} className="py-1.5 px-1.5 text-center">
                  -
                </td>
              ))}
              <td className="py-1.5 px-3 text-center text-sm font-semibold">{data.loser.score}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* MVP + Key Players */}
      <div className="border-t border-border px-3 py-2 space-y-0.5">
        <p className="text-xs">
          <span className="font-semibold">MVP:</span> {data.mvp.name}
          <span className="text-text-muted"> · {data.mvp.stats}</span>
        </p>
        {data.keyPlayers.map((player, i) => (
          <p key={i} className="text-xs text-text-muted">
            {player.name} · {player.stats}
          </p>
        ))}
      </div>

      {/* Venue / Attendance */}
      {(data.venue || data.attendance) && (
        <div className="border-t border-border px-3 py-1.5">
          <p className="text-xs text-text-muted">
            {data.venue}
            {data.venue && data.attendance && ' · '}
            {data.attendance}
          </p>
        </div>
      )}
    </motion.div>
  )
}

function BoxScoreSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-4 animate-pulse">
      <div className="px-3 py-2 bg-surface-alt">
        <div className="h-3 bg-border/50 rounded w-3/4" />
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="h-3 bg-surface-alt rounded w-full" />
        <div className="h-3 bg-surface-alt rounded w-full" />
      </div>
      <div className="border-t border-border px-3 py-2 space-y-1">
        <div className="h-3 bg-surface-alt rounded w-2/3" />
        <div className="h-2.5 bg-surface-alt rounded w-1/2" />
        <div className="h-2.5 bg-surface-alt rounded w-1/2" />
      </div>
    </div>
  )
}

// --- Helpers ---

function buildUserPrompt(c: Championship, opts?: { noCache?: boolean }): string {
  const is18and1 = c.game_title === 'Super Bowl XLII'
  const parts = [
    opts?.noCache ? `[no_cache]` : '',
    is18and1 ? `[18-1]` : '',
    `[championship_id:${c.id}]`,
    `Game: ${c.game_title}`,
    `Year: ${c.year}`,
    `League: ${LEAGUE_LABELS[c.league] || c.league}`,
    `Winner: ${c.winning_team_display_name}`,
  ].filter(Boolean)
  if (c.losing_team_display_name) {
    parts.push(`Loser: ${c.losing_team_display_name}`)
  }
  if (c.winning_score != null && c.losing_score != null) {
    parts.push(`Score: ${c.winning_score}–${c.losing_score}`)
  }
  if (c.championship_date) {
    parts.push(`Date: ${c.championship_date}`)
  }
  return parts.join('\n')
}

/** Minimal markdown-to-JSX renderer for streaming content */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headings
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-base font-bold mt-5 mb-2 first:mt-0">
          {line.slice(3)}
        </h2>,
      )
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-sm font-bold mt-4 mb-1">
          {line.slice(4)}
        </h3>,
      )
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={key++} className="ml-4 text-sm leading-relaxed list-disc">
          {renderInline(line.slice(2))}
        </li>,
      )
      continue
    }

    // Empty lines
    if (line.trim() === '') {
      continue
    }

    // Paragraphs
    elements.push(
      <p key={key++} className="text-sm leading-relaxed mb-2">
        {renderInline(line)}
      </p>,
    )
  }

  return elements
}

/** Render inline bold/italic */
function renderInline(text: string): React.ReactNode {
  // Handle **bold** and *italic*
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/)

    const match =
      boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)
        ? boldMatch
        : italicMatch

    if (!match || match.index === undefined) {
      parts.push(remaining)
      break
    }

    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index))
    }

    if (match[0].startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {match[1]}
        </strong>,
      )
    } else {
      parts.push(<em key={key++}>{match[1]}</em>)
    }

    remaining = remaining.slice(match.index + match[0].length)
  }

  return parts.length === 1 ? parts[0] : parts
}

// --- Main Drawer Component ---

export function GameDetailDrawer({
  championship,
  isLoss,
  onClose,
}: {
  championship: Championship | null
  isLoss?: boolean
  onClose: () => void
}) {
  const is18and1 = isLoss && championship?.game_title === 'Super Bowl XLII'

  const prevIdRef = useRef<number | null>(null)

  const connection = useMemo(() => fetchServerSentEvents('/api/game-detail'), [])

  const { messages, sendMessage, status, error, clear, stop } = useChat({
    connection,
  })

  // Send message when championship changes
  useEffect(() => {
    if (championship && championship.id !== prevIdRef.current) {
      prevIdRef.current = championship.id
      stop()
      clear()
      sendMessage(buildUserPrompt(championship))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championship?.id])

  // Reset on close — stop any in-flight stream
  useEffect(() => {
    if (!championship) {
      stop()
      prevIdRef.current = null
    }
  }, [championship, stop])

  // Escape key closes drawer
  useEffect(() => {
    if (!championship) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [championship, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (championship) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [championship])

  const handleRetry = useCallback(() => {
    if (championship) {
      stop()
      clear()
      sendMessage(buildUserPrompt(championship))
    }
  }, [championship, stop, clear, sendMessage])

  const handleRefresh = useCallback(() => {
    if (championship) {
      stop()
      clear()
      sendMessage(buildUserPrompt(championship, { noCache: true }))
    }
  }, [championship, stop, clear, sendMessage])

  // Get the assistant's streaming response
  const assistantMessage = messages.find((m) => m.role === 'assistant')
  const assistantText =
    assistantMessage?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.content)
      .join('') || ''

  const isStreaming = status === 'streaming' || status === 'submitted'
  const hasError = !!error

  // Parse box score from assistant text
  const { boxScore, narrativeText } = parseBoxScore(assistantText)

  // Determine if the boxscore JSON is still streaming (text started but no parsed result yet)
  const isBoxScoreStreaming = isStreaming && assistantText.includes('```boxscore') && !boxScore

  const logoUrl = championship
    ? getTeamLogoUrl(championship.team_league, championship.team_espn_id)
    : ''
  const hasScore =
    !is18and1 && championship?.winning_score != null && championship?.losing_score != null
  const isSeries = championship ? SERIES_LEAGUES.has(championship.league) : false
  const loadingLabel = isSeries ? 'Generating series details...' : 'Generating game summary...'

  return (
    <AnimatePresence>
      {championship && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 p-4 border-b border-border"
              style={{
                borderTopColor: championship.team_primary_color,
                borderTopWidth: '3px',
                borderTopStyle: 'solid',
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <img
                    src={logoUrl}
                    alt={championship.team_name}
                    className="w-10 h-10 object-contain flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-tight">
                      {championship.team_city} {championship.team_name}
                      {isLoss && (
                        <span
                          className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded align-middle ${is18and1 ? 'text-gray-400 bg-gray-100' : 'text-red-500 bg-red-50'}`}
                        >
                          {is18and1 ? '???' : 'Loss'}
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      {championship.game_title} &middot; {championship.year}
                    </p>
                    {hasScore && (
                      <p className="text-sm font-semibold mt-0.5">
                        {isLoss
                          ? `${championship.losing_score}–${championship.winning_score}`
                          : `${championship.winning_score}–${championship.losing_score}`}
                        {isLoss && championship.winning_team_display_name && (
                          <span className="font-normal text-text-muted">
                            {' '}
                            vs {championship.winning_team_display_name}
                          </span>
                        )}
                        {!isLoss && championship.losing_team_display_name && (
                          <span className="font-normal text-text-muted">
                            {' '}
                            vs {championship.losing_team_display_name}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Refresh button — hidden while streaming */}
                  {!isStreaming && assistantText && (
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="p-1.5 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer"
                      aria-label="Regenerate"
                      title="Regenerate summary"
                    >
                      <RotateCcw className="w-4 h-4 text-text-muted" />
                    </button>
                  )}
                  {/* Spinning refresh icon while streaming after a refresh */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-text-muted" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Loading skeleton */}
              {isStreaming && !assistantText && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingLabel}</span>
                  </div>
                  <BoxScoreSkeleton />
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-surface-alt rounded w-1/3" />
                    <div className="h-3 bg-surface-alt rounded w-full" />
                    <div className="h-3 bg-surface-alt rounded w-5/6" />
                    <div className="h-3 bg-surface-alt rounded w-4/6" />
                    <div className="h-4 bg-surface-alt rounded w-1/4 mt-4" />
                    <div className="h-3 bg-surface-alt rounded w-full" />
                    <div className="h-3 bg-surface-alt rounded w-3/4" />
                  </div>
                </div>
              )}

              {/* Box score streaming skeleton (JSON block started but not complete) */}
              {isBoxScoreStreaming && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingLabel}</span>
                  </div>
                  <BoxScoreSkeleton />
                </div>
              )}

              {/* Box Score Card */}
              {boxScore && <BoxScore data={boxScore} />}

              {/* Streaming / complete narrative */}
              {narrativeText && (
                <div className="streaming-text">
                  {renderMarkdown(narrativeText)}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-text-muted/60 animate-pulse ml-0.5 align-middle rounded-sm" />
                  )}
                </div>
              )}

              {/* Error state */}
              {hasError && !assistantText && (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500 mb-3">
                    {error.message || 'Failed to generate game summary'}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-nba hover:text-nba/80 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
