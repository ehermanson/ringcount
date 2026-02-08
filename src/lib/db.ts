import { createServerFn } from '@tanstack/react-start'

export type Team = {
  id: number
  name: string
  city: string
  league: string
  abbreviation: string
  espn_id: string
  primary_color: string
  secondary_color: string
}

export type Championship = {
  id: number
  year: number
  league: string
  winning_team_id: number
  winning_team_display_name: string
  losing_team_id: number | null
  losing_team_display_name: string | null
  winning_score: number | null
  losing_score: number | null
  game_title: string
  championship_date: string | null
  team_name: string
  team_city: string
  team_espn_id: string
  team_league: string
  team_primary_color: string
  team_abbreviation: string
}

export type TeamsByLeague = Record<string, Team[]>

const LEAGUE_ORDER = ['NFL', 'MLB', 'NBA', 'NHL', 'CFB', 'CBB']

async function getDB(): Promise<D1Database> {
  const { env } = await import('cloudflare:workers')
  return (env as Record<string, unknown>).DB as D1Database
}

export const getTeamsByLeague = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDB()

  const { results } = await db
    .prepare('SELECT * FROM teams ORDER BY league, city, name')
    .all<Team>()

  const grouped: TeamsByLeague = {}
  for (const league of LEAGUE_ORDER) {
    grouped[league] = []
  }
  for (const team of results) {
    if (!grouped[team.league]) {
      grouped[team.league] = []
    }
    grouped[team.league].push(team)
  }

  return grouped
})

export const getChampionships = createServerFn({ method: 'GET' })
  .inputValidator((input: { teamIds: Array<number>; sinceDate: string }) => input)
  .handler(async ({ data }) => {
    const { teamIds, sinceDate } = data
    if (!teamIds.length) return []

    const db = await getDB()
    const sinceYear = new Date(sinceDate + 'T00:00:00').getFullYear()

    const placeholders = teamIds.map(() => '?').join(',')
    const query = `
      SELECT
        c.*,
        t.name as team_name,
        t.city as team_city,
        t.espn_id as team_espn_id,
        t.league as team_league,
        t.primary_color as team_primary_color,
        t.abbreviation as team_abbreviation
      FROM championships c
      JOIN teams t ON c.winning_team_id = t.id
      WHERE c.winning_team_id IN (${placeholders})
        AND c.year >= ?
        AND (c.championship_date IS NULL OR c.championship_date >= ?)
      ORDER BY c.year DESC, c.league
    `

    const { results } = await db
      .prepare(query)
      .bind(...teamIds, sinceYear, sinceDate)
      .all<Championship>()

    return results
  })

export const getChampionshipLosses = createServerFn({ method: 'GET' })
  .inputValidator((input: { teamIds: Array<number>; sinceDate: string }) => input)
  .handler(async ({ data }) => {
    const { teamIds, sinceDate } = data
    if (!teamIds.length) return []

    const db = await getDB()
    const sinceYear = new Date(sinceDate + 'T00:00:00').getFullYear()

    const placeholders = teamIds.map(() => '?').join(',')
    const query = `
      SELECT
        c.*,
        t.name as team_name,
        t.city as team_city,
        t.espn_id as team_espn_id,
        t.league as team_league,
        t.primary_color as team_primary_color,
        t.abbreviation as team_abbreviation
      FROM championships c
      JOIN teams t ON c.losing_team_id = t.id
      WHERE c.losing_team_id IN (${placeholders})
        AND c.year >= ?
        AND (c.championship_date IS NULL OR c.championship_date >= ?)
      ORDER BY c.year DESC, c.league
    `

    const { results } = await db
      .prepare(query)
      .bind(...teamIds, sinceYear, sinceDate)
      .all<Championship>()

    return results
  })

export const getTeamsByIds = createServerFn({ method: 'GET' })
  .inputValidator((input: { teamIds: Array<number> }) => input)
  .handler(async ({ data }) => {
    const { teamIds } = data
    if (!teamIds.length) return []
    const db = await getDB()
    const placeholders = teamIds.map(() => '?').join(',')
    const { results } = await db
      .prepare(`SELECT * FROM teams WHERE id IN (${placeholders}) ORDER BY league, city`)
      .bind(...teamIds)
      .all<Team>()
    return results
  })

export function getTeamLogoUrl(league: string, espnId: string): string {
  return `/api/logo?league=${league}&id=${espnId}`
}

export const LEAGUE_LABELS: Record<string, string> = {
  NFL: 'NFL',
  MLB: 'MLB',
  NBA: 'NBA',
  NHL: 'NHL',
  CFB: 'College Football',
  CBB: 'College Basketball',
}
