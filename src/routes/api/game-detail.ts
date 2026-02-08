import { createFileRoute } from '@tanstack/react-router'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'

const SYSTEM_PROMPT = `You are a sports historian and storytelling expert. Given championship details, provide a compelling summary.

IMPORTANT: First, output a scoreboard in this exact JSON format wrapped in \`\`\`boxscore fences:

\`\`\`boxscore
{
  "winner": { "name": "Team Name", "abbreviation": "TM", "score": 31, "periods": [7, 10, 7, 7] },
  "loser": { "name": "Team Name", "abbreviation": "TM", "score": 17, "periods": [3, 7, 0, 7] },
  "periodLabel": "Q",
  "mvp": { "name": "Player Name", "team": "TM", "stats": "24 PTS, 11 REB, 5 AST" },
  "keyPlayers": [
    { "name": "Player", "team": "TM", "stats": "18 PTS, 7 REB" },
    { "name": "Player", "team": "TM", "stats": "312 YDS, 3 TD" }
  ],
  "venue": "Stadium Name",
  "attendance": "68,000"
}
\`\`\`

Rules for the boxscore — there are TWO formats depending on the sport:

**Single-game championships (NFL, College Football, College Basketball):**
- periodLabel: "Q" for NFL, "H" for CFB/CBB
- periods: score per period/half (e.g., [7, 10, 7, 7] for NFL quarters)
- score: final game score
- mvp: game MVP
- keyPlayers: 2-3 standout performers from the game beyond the MVP

**Series championships (NBA, NHL, MLB):**
- periodLabel: "Gm"
- periods: each team's score in each game of the series (e.g., [113, 109, 96, 100, 108, 106] for a 6-game series)
- score: series wins count (e.g., 4 for the winner, 2 for the loser)
- mvp: series MVP (e.g., Finals MVP, Conn Smythe, World Series MVP)
- keyPlayers: 2-3 standout performers across the series beyond the MVP
- Stats for mvp and keyPlayers should reflect series totals/averages (e.g., "averaged 28.5 PPG, 10.2 RPG" or "series: .400 BA, 3 HR, 8 RBI")

**Common rules:**
- keyPlayers: 2-3 standout performers beyond the MVP
- venue and attendance are optional — include if known
- Use real, accurate statistics. If unsure of exact scores, provide your best estimate

Then provide the narrative in this exact format:

## MVP
Name the MVP with a one-line description of their performance. For series (NBA/NHL/MLB), this is the series MVP.

## Key Moment
Describe the single most pivotal play or moment that defined the outcome. For series, pick the defining moment of the entire series.

## The Story
Write 2-3 engaging paragraphs telling the narrative. For single games (NFL/CFB/CBB), tell the story of the game. For series (NBA/NHL/MLB), tell the story of the series — the arc across games, momentum shifts, and the clinching moment.

## By the Numbers
List 3-5 notable statistics as bullet points. For series, include series-wide stats.

## Legacy
If significant, one paragraph on what this championship meant for the winning team. Otherwise, skip this section.

Keep responses factual. If you're unsure about specific details, focus on what is known and avoid fabricating statistics.`

const SUPER_BOWL_XLII_PROMPT = `You are a sports historian. You have no record of Super Bowl XLII. The Patriots went 18-0 between the regular season and two playoff games — but no data exists for the Super Bowl. The assumption is that the Patriots probably won. Respond in 2-3 dry, matter-of-fact sentences noting the missing records. Play it straight, like a confused archivist — no winking, no sarcasm, no exclamation points. Do NOT output a boxscore block.`

export const Route = createFileRoute('/api/game-detail')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        const messages = body.messages as {
          role: string
          content?: string
          parts?: { type: string; content: string }[]
        }[]

        // Extract text content from the first user message (supports both flat and parts-based formats)
        const userMessage = messages?.find((m) => m.role === 'user')
        const userContent =
          userMessage?.content ??
          userMessage?.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.content)
            .join('') ??
          ''

        let championshipId: number | null = null
        let noCache = false
        const idMatch = userContent.match(/\[championship_id:(\d+)\]/)
        if (idMatch) {
          championshipId = parseInt(idMatch[1], 10)
        }
        noCache = userContent.includes('[no_cache]')
        const isEasterEgg = userContent.includes('[18-1]')

        // Check D1 cache (skip if no_cache requested or easter egg)
        if (championshipId && !noCache && !isEasterEgg) {
          try {
            const { env } = await import('cloudflare:workers')
            const db = (env as Record<string, unknown>).DB as D1Database
            const cached = await db
              .prepare('SELECT content FROM game_details_cache WHERE championship_id = ?')
              .bind(championshipId)
              .first<{ content: string }>()

            if (cached) {
              // Return cached content as a quick SSE stream
              const encoder = new TextEncoder()
              const stream = new ReadableStream({
                start(controller) {
                  // Send RUN_STARTED
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'RUN_STARTED', runId: 'cached', threadId: 'cached' })}\n\n`,
                    ),
                  )
                  // Send TEXT_MESSAGE_START
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'TEXT_MESSAGE_START', messageId: 'cached-msg', role: 'assistant' })}\n\n`,
                    ),
                  )
                  // Send full content as one chunk
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'cached-msg', delta: cached.content })}\n\n`,
                    ),
                  )
                  // Send TEXT_MESSAGE_END
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'TEXT_MESSAGE_END', messageId: 'cached-msg' })}\n\n`,
                    ),
                  )
                  // Send RUN_FINISHED
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'RUN_FINISHED', runId: 'cached', finishReason: 'stop' })}\n\n`,
                    ),
                  )
                  controller.close()
                },
              })

              return new Response(stream, {
                headers: {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  Connection: 'keep-alive',
                },
              })
            }
          } catch {
            // Cache miss or DB error — fall through to OpenAI
          }
        }

        // Super Bowl XLII easter egg — flag set deterministically by the client
        const systemPrompt = userContent.includes('[18-1]') ? SUPER_BOWL_XLII_PROMPT : SYSTEM_PROMPT

        // Stream from OpenAI — abort if no chunks received for 15s
        const abortController = new AbortController()
        let idleTimer = setTimeout(() => abortController.abort(), 15_000)
        const resetIdleTimer = () => {
          clearTimeout(idleTimer)
          idleTimer = setTimeout(() => abortController.abort(), 15_000)
        }

        const adapter = openaiText('gpt-4o-mini')
        const rawStream = chat({
          adapter,
          systemPrompts: [systemPrompt],
          messages: messages as Parameters<typeof chat<typeof adapter>>[0]['messages'],
          abortController,
        })

        // Wrap stream: reset idle timer on each chunk + collect text for caching
        let fullText = ''
        async function* withIdleResetAndCache(source: typeof rawStream) {
          try {
            for await (const chunk of source) {
              resetIdleTimer()
              // Collect text content for caching
              if (
                championshipId &&
                chunk.type === 'TEXT_MESSAGE_CONTENT' &&
                'delta' in chunk &&
                typeof chunk.delta === 'string'
              ) {
                fullText += chunk.delta
              }
              yield chunk
            }
            clearTimeout(idleTimer)

            // Write to cache after stream completes (skip easter egg)
            if (championshipId && fullText && !isEasterEgg) {
              try {
                const { env } = await import('cloudflare:workers')
                const db = (env as Record<string, unknown>).DB as D1Database
                await db
                  .prepare(
                    'INSERT OR REPLACE INTO game_details_cache (championship_id, content, model) VALUES (?, ?, ?)',
                  )
                  .bind(championshipId, fullText, 'gpt-4o-mini')
                  .run()
              } catch {
                // Cache write failed — not critical
              }
            }
          } catch (err) {
            clearTimeout(idleTimer)
            throw err
          }
        }

        return toServerSentEventsResponse(withIdleResetAndCache(rawStream), { abortController })
      },
    },
  },
})
