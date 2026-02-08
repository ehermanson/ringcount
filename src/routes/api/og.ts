import { createFileRoute } from '@tanstack/react-router'
import { ImageResponse } from 'workers-og'

const INTER_REGULAR =
  'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
const INTER_BOLD =
  'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf'

function espnLogoUrl(league: string, espnId: string): string {
  const l = league.toUpperCase()
  if (l === 'CFB' || l === 'CBB') {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`
  }
  return `https://a.espncdn.com/i/teamlogos/${league.toLowerCase()}/500/${espnId}.png`
}

export const Route = createFileRoute('/api/og')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const count = url.searchParams.get('count') || '0'
        const dob = url.searchParams.get('dob') || ''
        const names = url.searchParams.get('names') || ''
        const logos = url.searchParams.get('logos') || ''
        const birthYear = dob ? dob.split('-')[0] : ''

        const [fontData, fontBoldData] = await Promise.all([
          fetch(INTER_REGULAR).then((r) => r.arrayBuffer()),
          fetch(INTER_BOLD).then((r) => r.arrayBuffer()),
        ])

        const subtitle = birthYear
          ? `${count === '1' ? 'championship' : 'championships'} in your lifetime`
          : `${count === '1' ? 'championship' : 'championships'}`

        // Parse logo entries (e.g., "NFL:ne,NBA:bos,MLB:bos")
        const logoEntries = logos
          ? logos.split(',').map((entry) => {
              const [league, espnId] = entry.split(':')
              return { league, espnId, url: espnLogoUrl(league, espnId) }
            })
          : []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content: any[] = [
          // Big count number
          {
            type: 'div',
            props: {
              style: { fontSize: '160px', fontWeight: 700, color: 'white', lineHeight: 1 },
              children: count,
            },
          },
          // Subtitle
          {
            type: 'div',
            props: {
              style: {
                fontSize: '32px',
                color: 'rgba(255,255,255,0.7)',
                marginTop: '12px',
              },
              children: subtitle,
            },
          },
        ]

        // Team logos row
        if (logoEntries.length > 0) {
          content.push({
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '32px',
              },
              children: logoEntries.map((l) => ({
                type: 'img',
                props: {
                  src: l.url,
                  width: 64,
                  height: 64,
                  style: { objectFit: 'contain' },
                },
              })),
            },
          })
        }

        // Team names
        if (names) {
          content.push({
            type: 'div',
            props: {
              style: {
                fontSize: '20px',
                color: 'rgba(255,255,255,0.5)',
                marginTop: logoEntries.length > 0 ? '12px' : '28px',
                textAlign: 'center',
              },
              children: names.split(',').join(' \u00B7 '),
            },
          })
        }

        // Root container — matches hero card gradient: from-nfl via-nba to-cfb
        const element = {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '1200px',
              height: '630px',
              background: 'linear-gradient(135deg, #013369 0%, #1d428a 50%, #8b0000 100%)',
              fontFamily: 'Inter',
              padding: '60px',
              position: 'relative',
            },
            children: [
              ...content,
              // Branding
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: '36px',
                    right: '48px',
                    fontSize: '22px',
                    color: 'rgba(255,255,255,0.35)',
                    fontWeight: 600,
                  },
                  children: 'ringcount.app',
                },
              },
            ],
          },
        }

        const imgResponse = new ImageResponse(element as unknown as React.ReactNode, {
          width: 1200,
          height: 630,
          fonts: [
            { name: 'Inter', data: fontData, weight: 400, style: 'normal' },
            { name: 'Inter', data: fontBoldData, weight: 700, style: 'normal' },
          ],
        })

        const pngBuffer = await imgResponse.arrayBuffer()

        return new Response(pngBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800',
          },
        })
      },
    },
  },
})
