import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useInView } from 'motion/react'
import { type Championship, getTeamLogoUrl, LEAGUE_LABELS } from '../db'
import { LeagueLogo } from '../league-logo'
import { formatDate } from './utils'

export function TimelineItemWrapper({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20, scale: 0.97 }}
      animate={isInView ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -20, scale: 0.97 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

/** Fisheye-style scaling for timeline year groups based on scroll position */
export function FisheyeYear({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const raf = useRef(0)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const viewH = window.innerHeight
    const center = rect.top + rect.height / 2
    const viewCenter = viewH / 2
    // 0 = dead center, 1 = at edge
    const dist = Math.min(Math.abs(center - viewCenter) / (viewH / 2), 1)
    // Ease the curve so the middle ~40% is at full scale
    const eased = Math.max(0, (dist - 0.3) / 0.7)
    setScale(1 - eased * 0.08)
    setOpacity(1 - eased * 0.3)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [update])

  return (
    <div
      ref={ref}
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: 'left center',
        transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
      }}
    >
      {children}
    </div>
  )
}

export function TimelineEntry({
  championship,
  onSelect,
}: {
  championship: Championship
  onSelect: (c: Championship) => void
}) {
  const logoUrl = getTeamLogoUrl(championship.team_league, championship.team_espn_id)

  const hasScore = championship.winning_score != null && championship.losing_score != null

  return (
    <div className="relative pb-3 pl-8">
      {/* Timeline dot — small accent for championship wins */}
      <div
        className="absolute left-0 w-2 h-2 rounded-full z-10 -ml-[4px] mt-5"
        style={{ backgroundColor: championship.team_primary_color }}
      />

      {/* Content card */}
      <div
        className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => onSelect(championship)}
      >
        <div className="flex">
          {/* Colored left bar */}
          <div
            className="w-1 flex-shrink-0"
            style={{ backgroundColor: championship.team_primary_color }}
          />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              <img
                src={logoUrl}
                alt={championship.team_name}
                className="w-12 h-12 object-contain flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd" rx="12"/><text x="50" y="55" text-anchor="middle" font-size="32" fill="%23999">?</text></svg>'
                }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">
                  {championship.team_city} {championship.team_name}
                </h3>
                {championship.losing_team_display_name ? (
                  <p className="text-sm mt-0.5">
                    <span className="text-text-muted">def.</span>{' '}
                    <span className="font-medium">{championship.losing_team_display_name}</span>
                    {hasScore && (
                      <span className="font-semibold ml-1">
                        {championship.winning_score}&ndash;{championship.losing_score}
                      </span>
                    )}
                  </p>
                ) : (
                  hasScore && (
                    <p className="text-sm font-semibold mt-0.5">
                      {championship.winning_score}&ndash;{championship.losing_score}
                    </p>
                  )
                )}
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                  <LeagueLogo league={championship.league} className="w-3.5 h-3.5 inline-block" />
                  {championship.game_title} &middot;{' '}
                  {LEAGUE_LABELS[championship.league] || championship.league}
                  {championship.championship_date && (
                    <span> &middot; {formatDate(championship.championship_date)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TimelineLossEntry({
  championship,
  onSelect,
}: {
  championship: Championship
  onSelect: (c: Championship) => void
}) {
  const logoUrl = getTeamLogoUrl(championship.team_league, championship.team_espn_id)

  const hasScore = championship.winning_score != null && championship.losing_score != null

  return (
    <div className="relative pb-3 pl-8">
      {/* Timeline dot — small hollow for losses */}
      <div
        className="absolute left-0 w-2 h-2 rounded-full border-[1.5px] bg-white z-10 -ml-[4px] mt-5"
        style={{ borderColor: championship.team_primary_color }}
      />

      {/* Content card */}
      <div
        className="flex-1 bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow opacity-50 cursor-pointer"
        onClick={() => onSelect(championship)}
      >
        <div className="flex">
          {/* Dashed left bar for losses */}
          <div
            className="w-1 flex-shrink-0 opacity-40"
            style={{ backgroundColor: championship.team_primary_color }}
          />

          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              <img
                src={logoUrl}
                alt={championship.team_name}
                className="w-12 h-12 object-contain flex-shrink-0 grayscale-[50%]"
                loading="lazy"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd" rx="12"/><text x="50" y="55" text-anchor="middle" font-size="32" fill="%23999">?</text></svg>'
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold leading-tight">
                    {championship.team_city} {championship.team_name}
                  </h3>
                  <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                    Loss
                  </span>
                </div>
                <p className="text-sm mt-0.5">
                  <span className="text-text-muted">lost to</span>{' '}
                  <span className="font-medium">{championship.winning_team_display_name}</span>
                  {hasScore && (
                    <span className="font-semibold ml-1">
                      {championship.losing_score}&ndash;{championship.winning_score}
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                  <LeagueLogo league={championship.league} className="w-3.5 h-3.5 inline-block" />
                  {championship.game_title} &middot;{' '}
                  {LEAGUE_LABELS[championship.league] || championship.league}
                  {championship.championship_date && (
                    <span> &middot; {formatDate(championship.championship_date)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
