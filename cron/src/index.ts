interface Env {
  DB: D1Database
}

interface LeagueConfig {
  league: string
  sport: string
  espnLeague: string
  keywords: string[]
  gameTitle: string
  isSeries: boolean
}

const LEAGUES: LeagueConfig[] = [
  {
    league: 'NFL',
    sport: 'football',
    espnLeague: 'nfl',
    keywords: ['Super Bowl'],
    gameTitle: 'Super Bowl',
    isSeries: false,
  },
  {
    league: 'MLB',
    sport: 'baseball',
    espnLeague: 'mlb',
    keywords: ['World Series'],
    gameTitle: 'World Series',
    isSeries: true,
  },
  {
    league: 'NBA',
    sport: 'basketball',
    espnLeague: 'nba',
    keywords: ['NBA Finals'],
    gameTitle: 'NBA Finals',
    isSeries: true,
  },
  {
    league: 'NHL',
    sport: 'hockey',
    espnLeague: 'nhl',
    keywords: ['Stanley Cup'],
    gameTitle: 'Stanley Cup Finals',
    isSeries: true,
  },
  {
    league: 'CFB',
    sport: 'football',
    espnLeague: 'college-football',
    keywords: ['National Championship'],
    gameTitle: 'CFP National Championship',
    isSeries: false,
  },
  {
    league: 'CBB',
    sport: 'basketball',
    espnLeague: 'mens-college-basketball',
    keywords: ['National Championship'],
    gameTitle: 'NCAA Championship Game',
    isSeries: false,
  },
]

interface ESPNCompetitor {
  team: { id: string; displayName: string }
  score: string
  winner?: boolean
  order: number
}

interface ESPNSeries {
  completed: boolean
  summary: string
}

interface ESPNCompetition {
  competitors: ESPNCompetitor[]
  series?: ESPNSeries
  date: string
}

interface ESPNStatus {
  type: { completed: boolean }
}

interface ESPNEvent {
  name: string
  season: { year: number }
  status: ESPNStatus
  competitions: ESPNCompetition[]
  notes?: Array<{ headline: string }>
}

interface ESPNResponse {
  events: ESPNEvent[]
}

function matchesKeywords(event: ESPNEvent, keywords: string[]): boolean {
  const name = event.name.toLowerCase()
  const noteText = (event.notes ?? []).map((n) => n.headline.toLowerCase()).join(' ')
  const combined = `${name} ${noteText}`
  return keywords.some((kw) => combined.includes(kw.toLowerCase()))
}

function getDateRange(): string {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)

  const fmt = (d: Date) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0')

  return `${fmt(start)}-${fmt(end)}`
}

function parseSeriesSummary(summary: string): {
  winnerWins: number
  loserWins: number
} | null {
  // ESPN series summary looks like "Team A wins series 4-2"
  // or simply "4-2" or "Series tied 3-3" etc.
  const match = summary.match(/(\d+)-(\d+)/)
  if (!match) return null
  const a = parseInt(match[1], 10)
  const b = parseInt(match[2], 10)
  return { winnerWins: Math.max(a, b), loserWins: Math.min(a, b) }
}

async function lookupTeam(
  db: D1Database,
  espnId: string,
  league: string,
): Promise<{ id: number; name: string; city: string } | null> {
  const row = await db
    .prepare('SELECT id, name, city FROM teams WHERE espn_id = ? AND league = ?')
    .bind(espnId, league)
    .first<{ id: number; name: string; city: string }>()
  return row ?? null
}

async function championshipExists(
  db: D1Database,
  league: string,
  year: number,
  gameTitle: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM championships WHERE league = ? AND year = ? AND game_title = ?')
    .bind(league, year, gameTitle)
    .first()
  return row !== null
}

async function processLeague(db: D1Database, config: LeagueConfig): Promise<void> {
  const dateRange = getDateRange()
  const url = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/scoreboard?seasontype=3&dates=${dateRange}`

  console.log(`[${config.league}] Fetching: ${url}`)
  const resp = await fetch(url)
  if (!resp.ok) {
    console.log(`[${config.league}] ESPN API returned ${resp.status}, skipping`)
    return
  }

  const data = (await resp.json()) as ESPNResponse
  const events = data.events ?? []
  console.log(`[${config.league}] Found ${events.length} event(s)`)

  for (const event of events) {
    if (!matchesKeywords(event, config.keywords)) {
      continue
    }
    console.log(`[${config.league}] Matched championship event: ${event.name}`)

    const seasonYear = event.season.year

    if (config.isSeries) {
      await processSeriesEvent(db, config, event, seasonYear)
    } else {
      await processSingleGameEvent(db, config, event, seasonYear)
    }
  }
}

async function processSingleGameEvent(
  db: D1Database,
  config: LeagueConfig,
  event: ESPNEvent,
  seasonYear: number,
): Promise<void> {
  if (!event.status.type.completed) {
    console.log(`[${config.league}] Game not yet completed, skipping`)
    return
  }

  const competition = event.competitions[0]
  const competitors = competition.competitors

  // Determine winner by higher score (or winner flag)
  let winner: ESPNCompetitor
  let loser: ESPNCompetitor

  if (competitors[0].winner !== undefined) {
    winner = competitors.find((c) => c.winner)!
    loser = competitors.find((c) => !c.winner)!
  } else {
    const sorted = [...competitors].sort((a, b) => parseInt(b.score) - parseInt(a.score))
    winner = sorted[0]
    loser = sorted[1]
  }

  const winningScore = parseInt(winner.score)
  const losingScore = parseInt(loser.score)

  // Build game title — for NFL, use the event name (e.g., "Super Bowl LIX")
  let gameTitle = config.gameTitle
  if (config.league === 'NFL') {
    // Event name is usually like "Super Bowl LIX" or "Kansas City Chiefs at Philadelphia Eagles"
    // Check notes first for explicit title, then fall back to event name
    const sbNote = (event.notes ?? []).find((n) => n.headline.toLowerCase().includes('super bowl'))
    if (sbNote) {
      gameTitle = sbNote.headline
    } else if (event.name.toLowerCase().includes('super bowl')) {
      // Extract just the "Super Bowl XXX" part
      const match = event.name.match(/Super Bowl [LXVI0-9]+/i)
      gameTitle = match ? match[0] : event.name
    }
  }

  const champDate = competition.date.split('T')[0]

  await insertChampionship(
    db,
    config.league,
    seasonYear,
    winner,
    loser,
    winningScore,
    losingScore,
    gameTitle,
    champDate,
  )
}

async function processSeriesEvent(
  db: D1Database,
  config: LeagueConfig,
  event: ESPNEvent,
  seasonYear: number,
): Promise<void> {
  const competition = event.competitions[0]
  const series = competition.series

  if (!series?.completed) {
    console.log(`[${config.league}] Series not yet completed, skipping`)
    return
  }

  const competitors = competition.competitors
  const scores = parseSeriesSummary(series.summary)
  if (!scores) {
    console.log(`[${config.league}] Could not parse series summary: ${series.summary}`)
    return
  }

  // Determine series winner — the competitor flagged as winner, or the one with more wins
  let winner: ESPNCompetitor
  let loser: ESPNCompetitor

  if (competitors[0].winner !== undefined) {
    winner = competitors.find((c) => c.winner)!
    loser = competitors.find((c) => !c.winner)!
  } else {
    // Fall back: the team listed first in a completed series is often the winner
    // but we'll use the series summary to help
    const sorted = [...competitors].sort((a, b) => parseInt(b.score) - parseInt(a.score))
    winner = sorted[0]
    loser = sorted[1]
  }

  const champDate = competition.date.split('T')[0]

  await insertChampionship(
    db,
    config.league,
    seasonYear,
    winner,
    loser,
    scores.winnerWins,
    scores.loserWins,
    config.gameTitle,
    champDate,
  )
}

async function insertChampionship(
  db: D1Database,
  league: string,
  year: number,
  winner: ESPNCompetitor,
  loser: ESPNCompetitor,
  winningScore: number,
  losingScore: number,
  gameTitle: string,
  champDate: string,
): Promise<void> {
  // Dedup check
  const exists = await championshipExists(db, league, year, gameTitle)
  if (exists) {
    console.log(`[${league}] Already have ${gameTitle} for ${year}, skipping`)
    return
  }

  // Look up team IDs
  const winnerTeam = await lookupTeam(db, winner.team.id, league)
  const loserTeam = await lookupTeam(db, loser.team.id, league)

  const winDisplayName = winnerTeam
    ? `${winnerTeam.city} ${winnerTeam.name}`
    : winner.team.displayName
  const loseDisplayName = loserTeam ? `${loserTeam.city} ${loserTeam.name}` : loser.team.displayName

  console.log(
    `[${league}] Inserting: ${year} ${gameTitle} — ${winDisplayName} (${winningScore}) def. ${loseDisplayName} (${losingScore})`,
  )

  await db
    .prepare(
      `INSERT INTO championships
        (year, league, winning_team_id, winning_team_display_name, losing_team_id, losing_team_display_name, winning_score, losing_score, game_title, championship_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      year,
      league,
      winnerTeam?.id ?? null,
      winDisplayName,
      loserTeam?.id ?? null,
      loseDisplayName,
      winningScore,
      losingScore,
      gameTitle,
      champDate,
    )
    .run()

  console.log(`[${league}] Inserted successfully`)
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log('Cron triggered: checking for new championships')

    const results = await Promise.allSettled(LEAGUES.map((config) => processLeague(env.DB, config)))

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        console.log(`[${LEAGUES[i].league}] ERROR: ${result.reason}`)
      }
    }

    console.log('Cron complete')
  },

  async fetch(_request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Allow manual trigger via HTTP for testing
    ctx.waitUntil(this.scheduled({} as ScheduledController, env, ctx))
    return new Response('Cron triggered manually', { status: 200 })
  },
}
