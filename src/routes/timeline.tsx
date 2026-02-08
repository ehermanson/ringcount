import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getChampionships,
  getChampionshipLosses,
  getTeamsByIds,
  getTeamLogoUrl,
  type Championship,
  type Team,
} from '../lib/db'
import { GameDetailDrawer } from '../lib/game-detail'
import { motion } from 'motion/react'
import { type TimelineItem, champYear } from '../lib/timeline/utils'
import {
  TimelineItemWrapper,
  FisheyeYear,
  TimelineEntry,
  TimelineLossEntry,
} from '../lib/timeline/entries'
import { StatsBar } from '../lib/timeline/stats-bar'

type TimelineSearch = {
  dob: string
  teams: string
  losses?: boolean
}

export const Route = createFileRoute('/timeline')({
  validateSearch: (search: Record<string, unknown>): TimelineSearch => ({
    dob: (search.dob as string) || '',
    teams: (search.teams as string) || '',
    losses: search.losses === false || search.losses === 'false' ? false : undefined,
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
  head: ({ loaderData, match }) => {
    const data = loaderData as
      | { championships: Championship[]; losses: Championship[]; teams: Team[] }
      | undefined
    const search = match.search as TimelineSearch
    const count = data?.championships.length ?? 0
    const birthYear = search.dob ? new Date(search.dob).getFullYear() : ''
    const teamNames = data?.teams.map((t) => `${t.city} ${t.name}`).join(', ') ?? ''
    const ogTitle = birthYear
      ? `${count} Championship${count !== 1 ? 's' : ''} Since ${birthYear} | Ring Count`
      : `${count} Championship${count !== 1 ? 's' : ''} | Ring Count`
    const ogDescription = teamNames ? `${teamNames} \u2014 see every ring` : 'See every ring'
    const ogImage = `https://ringcount.app/api/og?count=${count}&dob=${encodeURIComponent(search.dob)}&names=${encodeURIComponent(teamNames)}&teams=${encodeURIComponent(search.teams)}`

    return {
      meta: [
        { title: ogTitle },
        { property: 'og:title', content: ogTitle },
        { property: 'og:description', content: ogDescription },
        { property: 'og:image', content: ogImage },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    }
  },
  component: TimelinePage,
})

function TimelinePage() {
  const { championships, losses, teams } = Route.useLoaderData() as {
    championships: Championship[]
    losses: Championship[]
    teams: Team[]
  }
  const { dob, losses: lossesParam } = Route.useSearch()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [selectedChampionship, setSelectedChampionship] = useState<{
    championship: Championship
    isLoss: boolean
  } | null>(null)
  const hideLosses = lossesParam === false
  const showLosses = !hideLosses

  const setHideLosses = (hide: boolean) => {
    navigate({
      to: '/timeline',
      search: (prev) => ({ ...prev, losses: hide ? false : undefined }) as TimelineSearch,
      replace: true,
      resetScroll: false,
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
            {birthYear}{' '}
            <span className="text-xs">
              ({championships.length + losses.length} appearance
              {championships.length + losses.length !== 1 ? 's' : ''})
            </span>
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
          <StatsBar championships={championships} losses={losses} birthYear={birthYear} />
        )}

        {/* Losses toggle */}
        {losses.length > 0 && (
          <div className="flex items-center justify-end mb-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-muted">
              <span>Hide championship losses</span>
              <button
                type="button"
                role="switch"
                aria-checked={hideLosses}
                onClick={() => setHideLosses(!hideLosses)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hideLosses ? 'bg-nba' : 'bg-border'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${hideLosses ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
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
                          <div className="absolute left-0 -ml-[7px] w-3.5 h-3.5 rounded-full bg-text z-10 ring-[3px] ring-surface" />
                          <span className="text-2xl font-black text-text">{year}</span>
                        </div>
                      </TimelineItemWrapper>

                      {items.map((item, i) =>
                        item._isLoss ? (
                          <TimelineItemWrapper key={`loss-${item.id}`} delay={0.06 * (i + 1)}>
                            <TimelineLossEntry
                              championship={item}
                              onSelect={(c) =>
                                setSelectedChampionship({ championship: c, isLoss: true })
                              }
                            />
                          </TimelineItemWrapper>
                        ) : (
                          <TimelineItemWrapper key={item.id} delay={0.06 * (i + 1)}>
                            <TimelineEntry
                              championship={item}
                              onSelect={(c) =>
                                setSelectedChampionship({ championship: c, isLoss: false })
                              }
                            />
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

      <GameDetailDrawer
        championship={selectedChampionship?.championship ?? null}
        isLoss={selectedChampionship?.isLoss}
        onClose={() => setSelectedChampionship(null)}
      />
    </div>
  )
}
