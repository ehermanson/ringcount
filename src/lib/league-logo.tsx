const LOGO_URLS: Record<string, string> = {
  NFL: '/api/logo?league=nfl',
  MLB: '/api/logo?league=mlb',
  NBA: '/api/logo?league=nba',
  NHL: '/api/logo?league=nhl',
  CFB: '/api/logo?league=cfb',
  CBB: '/api/logo?league=cbb',
}

export function LeagueLogo({ league, className }: { league: string; className?: string }) {
  const url = LOGO_URLS[league]
  if (!url) return null
  return <img src={url} alt={`${league} logo`} className={className} />
}
