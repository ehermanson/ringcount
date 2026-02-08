const LOGO_URLS: Record<string, string> = {
  NFL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png&w=100',
  MLB: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/mlb.png&w=100',
  NBA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png&w=100',
  NHL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nhl.png&w=100',
  CFB: 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa_football.png',
  CBB: 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png',
}

export function LeagueLogo({ league, className }: { league: string; className?: string }) {
  const url = LOGO_URLS[league]
  if (!url) return null
  return <img src={url} alt={`${league} logo`} className={className} />
}
