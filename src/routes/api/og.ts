import { createFileRoute } from '@tanstack/react-router'
import { ImageResponse } from 'workers-og'

const INTER_REGULAR =
  'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
const INTER_BOLD =
  'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf'
const INTER_BLACK =
  'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf'

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

        const [fontData, fontBoldData, fontBlackData] = await Promise.all([
          fetch(INTER_REGULAR).then((r) => r.arrayBuffer()),
          fetch(INTER_BOLD).then((r) => r.arrayBuffer()),
          fetch(INTER_BLACK).then((r) => r.arrayBuffer()),
        ])

        const subtitle = birthYear
          ? `${count === '1' ? 'championship' : 'championships'} in your lifetime`
          : `${count === '1' ? 'championship' : 'championships'}`

        // Parse logo entries (e.g., "NFL:ne:3,NBA:bos:5,MLB:bos:2")
        const logoEntries = logos
          ? logos.split(',').map((entry) => {
              const [league, espnId, champCount] = entry.split(':')
              return {
                league,
                espnId,
                champCount: champCount || '0',
                url: espnLogoUrl(league, espnId),
              }
            })
          : []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content: any[] = [
          // Big count number — extra bold black weight
          {
            type: 'div',
            props: {
              style: {
                fontSize: '180px',
                fontWeight: 900,
                color: 'white',
                lineHeight: 1,
                letterSpacing: '-4px',
              },
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
                marginTop: '8px',
                fontWeight: 400,
                letterSpacing: '1px',
              },
              children: subtitle,
            },
          },
        ]

        // Decorative divider
        content.push({
          type: 'div',
          props: {
            style: {
              width: '80px',
              height: '3px',
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '2px',
              marginTop: '24px',
            },
          },
        })

        // Team logos row with championship counts
        if (logoEntries.length > 0) {
          content.push({
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '28px',
                marginTop: '28px',
              },
              children: logoEntries.map((l) => ({
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: l.url,
                        width: 56,
                        height: 56,
                        style: { objectFit: 'contain' },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '28px',
                          fontWeight: 900,
                          color: 'white',
                          lineHeight: 1,
                        },
                        children: l.champCount,
                      },
                    },
                  ],
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
                fontSize: '18px',
                color: 'rgba(255,255,255,0.45)',
                marginTop: '16px',
                textAlign: 'center',
                letterSpacing: '0.5px',
              },
              children: names.split(',').join('  \u00B7  '),
            },
          })
        }

        // Root container
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
              // Subtle ring decoration top-left
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: '-80px',
                    left: '-80px',
                    width: '280px',
                    height: '280px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.06)',
                  },
                },
              },
              // Subtle ring decoration bottom-right
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: '-100px',
                    right: '-100px',
                    width: '350px',
                    height: '350px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.06)',
                  },
                },
              },
              ...content,
              // Branding
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: '32px',
                    right: '44px',
                    fontSize: '20px',
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
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
            { name: 'Inter', data: fontBlackData, weight: 900, style: 'normal' },
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
