import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

const LS_KEY = 'championship-tracker-selections'
import {
  getTeamsByLeague,
  getTeamLogoUrl,
  LEAGUE_LABELS,
  type Team,
  type TeamsByLeague,
} from '../lib/db'

type SelectSearch = {
  dob: string
}

export const Route = createFileRoute('/select')({
  validateSearch: (search: Record<string, unknown>): SelectSearch => ({
    dob: (search.dob as string) || '',
  }),
  loaderDeps: ({ search }) => ({ dob: search.dob }),
  loader: async () => {
    const teams = await getTeamsByLeague()
    return { teams }
  },
  component: SelectPage,
})

function TeamCard({
  team,
  selected,
  onToggle,
}: {
  team: Team
  selected: boolean
  onToggle: () => void
}) {
  const logoUrl = getTeamLogoUrl(team.league, team.espn_id)

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer
        ${
          selected
            ? 'border-current shadow-md scale-[1.02]'
            : 'border-border hover:border-gray-300 hover:shadow-sm'
        }`}
      style={
        selected
          ? { borderColor: team.primary_color, backgroundColor: team.primary_color + '10' }
          : undefined
      }
    >
      <img
        src={logoUrl}
        alt={`${team.city} ${team.name}`}
        className="w-12 h-12 object-contain"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).src =
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd" rx="12"/><text x="50" y="55" text-anchor="middle" font-size="32" fill="%23999">?</text></svg>'
        }}
      />
      <span className="text-xs font-medium text-center leading-tight">
        {team.city}
        <br />
        {team.name}
      </span>
      {selected && (
        <div
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
          style={{ backgroundColor: team.primary_color }}
        >
          ✓
        </div>
      )}
    </button>
  )
}

function LeagueSection({
  league,
  teams,
  selectedIds,
  onToggle,
}: {
  league: string
  teams: Team[]
  selectedIds: Set<number>
  onToggle: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const selectedCount = teams.filter((t) => selectedIds.has(t.id)).length

  return (
    <section id={`league-${league}`} className="mb-6 scroll-mt-16">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-1 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">{LEAGUE_LABELS[league] || league}</h2>
          {selectedCount > 0 && (
            <span className="text-xs font-semibold bg-nba text-white px-2 py-0.5 rounded-full">
              {selectedCount} selected
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mt-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              selected={selectedIds.has(team.id)}
              onToggle={() => onToggle(team.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SelectPage() {
  const { teams } = Route.useLoaderData() as { teams: TeamsByLeague }
  const { dob } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const { teamIds } = JSON.parse(saved)
        if (Array.isArray(teamIds) && teamIds.length > 0) {
          return new Set(teamIds as number[])
        }
      }
    } catch {}
    return new Set()
  })
  const [filter, setFilter] = useState('')

  const filterLower = filter.toLowerCase()
  const filteredTeams: TeamsByLeague = {}
  for (const [league, leagueTeams] of Object.entries(teams)) {
    if (!filterLower) {
      filteredTeams[league] = leagueTeams
    } else {
      const filtered = leagueTeams.filter(
        (t) =>
          t.name.toLowerCase().includes(filterLower) ||
          t.city.toLowerCase().includes(filterLower) ||
          t.abbreviation.toLowerCase().includes(filterLower),
      )
      if (filtered.length > 0) {
        filteredTeams[league] = filtered
      }
    }
  }

  const teamLeagueMap = new Map<number, string>()
  for (const [league, leagueTeams] of Object.entries(teams)) {
    for (const t of leagueTeams) {
      teamLeagueMap.set(t.id, league)
    }
  }

  const toggleTeam = (id: number) => {
    const wasSelected = selectedIds.has(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

    if (!wasSelected) {
      const league = teamLeagueMap.get(id)
      if (league) {
        const leagueKeys = Object.keys(filteredTeams)
        const idx = leagueKeys.indexOf(league)
        const nextLeague = leagueKeys[idx + 1]
        if (nextLeague) {
          requestAnimationFrame(() => {
            const el = document.getElementById(`league-${nextLeague}`)
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY - 72
              window.scrollTo({ top, behavior: 'smooth' })
            }
          })
        }
      }
    }
  }

  const handleViewTimeline = () => {
    if (selectedIds.size === 0) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ dob, teamIds: Array.from(selectedIds) }))
    } catch {}
    navigate({
      to: '/timeline',
      search: { dob, teams: Array.from(selectedIds).join(',') },
    })
  }

  const handleClearSelections = () => {
    setSelectedIds(new Set())
    try {
      localStorage.removeItem(LS_KEY)
    } catch {}
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="text-sm text-text-muted hover:text-text mb-4 inline-flex items-center gap-1 cursor-pointer"
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
            Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Pick Your Teams</h1>
          <p className="text-text-muted">
            Select your favorite teams to see their championships since{' '}
            <span className="font-semibold text-text">
              {new Date(dob + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>

        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm py-3 mb-4">
          <input
            type="text"
            placeholder="Search teams..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text focus:outline-none focus:ring-2 focus:ring-nba focus:border-transparent"
          />
        </div>

        {Object.entries(filteredTeams).map(([league, leagueTeams]) => (
          <LeagueSection
            key={league}
            league={league}
            teams={leagueTeams}
            selectedIds={selectedIds}
            onToggle={toggleTeam}
          />
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-border p-4">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm text-text-muted">
                <span className="font-semibold text-text">{selectedIds.size}</span> team
                {selectedIds.size !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={handleClearSelections}
                className="text-xs text-text-muted hover:text-red-500 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={handleViewTimeline}
              className="py-2.5 px-8 rounded-xl bg-nba text-white font-semibold hover:bg-nba/90 active:scale-[0.98] transition-all cursor-pointer flex-shrink-0 ml-auto"
            >
              View Timeline
            </button>
            <div className="flex items-center gap-0.5 overflow-x-auto w-full sm:w-auto sm:flex-1 sm:order-[-1] sm:ml-0">
              {Object.values(teams)
                .flat()
                .filter((t) => selectedIds.has(t.id))
                .map((t) => (
                  <img
                    key={t.id}
                    src={getTeamLogoUrl(t.league, t.espn_id)}
                    alt={`${t.city} ${t.name}`}
                    title={`${t.city} ${t.name}`}
                    className="w-6 h-6 object-contain flex-shrink-0 animate-scale-in"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
