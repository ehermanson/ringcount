import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/logo')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const league = url.searchParams.get('league')
        const id = url.searchParams.get('id')

        if (!league) {
          return new Response('Missing league parameter', { status: 400 })
        }

        // Build ESPN CDN URL
        const leagueLower = league.toLowerCase()
        const leagueUpper = league.toUpperCase()
        let cdnUrl: string
        if (!id) {
          // League logo — CFB/CBB use different ESPN paths
          if (leagueUpper === 'CFB') {
            cdnUrl = 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa_football.png'
          } else if (leagueUpper === 'CBB') {
            cdnUrl = 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png'
          } else {
            cdnUrl = `https://a.espncdn.com/i/teamlogos/leagues/500/${leagueLower}.png`
          }
        } else if (leagueUpper === 'CFB' || leagueUpper === 'CBB') {
          cdnUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`
        } else {
          cdnUrl = `https://a.espncdn.com/i/teamlogos/${leagueLower}/500/${id}.png`
        }

        const response = await fetch(cdnUrl)
        if (!response.ok) {
          return new Response('Logo not found', { status: 404 })
        }

        const imageBuffer = await response.arrayBuffer()
        return new Response(imageBuffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=604800, s-maxage=2592000',
          },
        })
      },
    },
  },
})
