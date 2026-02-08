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
One paragraph on what this championship meant for the winning team and its place in sports history.

SPECIAL CASE: If the game is Super Bowl XLII (2007 season / February 2008 — the one where the Patriots were 18-0 going in), do NOT output a boxscore block. Instead, respond with a short humorous denial insisting there is no evidence this game ever took place, nobody knows anything about it, and the Patriots probably won. Keep it deadpan and brief. NOTE: This ONLY applies to Super Bowl XLII. All other Patriots losses (including Super Bowl XLVI, Super Bowl LII, etc.) should be covered normally with full boxscores and narratives like any other game.

Keep responses factual. If you're unsure about specific details, focus on what is known and avoid fabricating statistics.`

export const Route = createFileRoute('/api/game-detail')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        const messages = body.messages as { role: string; content: string }[]

        // Extract championship_id and no_cache flag from the first user message
        const userMessage = messages?.find((m) => m.role === 'user')
        let championshipId: number | null = null
        let noCache = false
        if (userMessage) {
          const content = userMessage.content
          if (content) {
            const match = content.match(/\[championship_id:(\d+)\]/)
            if (match) {
              championshipId = parseInt(match[1], 10)
            }
            noCache = content.includes('[no_cache]')
          }
        }

        // Check D1 cache (skip if no_cache requested)
        if (championshipId && !noCache) {
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

        // Stream from OpenAI
        const abortController = new AbortController()

        // Tee the stream: one for the response, one for caching
        const adapter = openaiText('gpt-4o-mini')
        const stream = chat({
          adapter,
          systemPrompts: [SYSTEM_PROMPT],
          messages: messages as Parameters<typeof chat<typeof adapter>>[0]['messages'],
          abortController,
        })

        // If we have a championship_id, buffer and cache the response
        if (championshipId) {
          const champId = championshipId

          // We need to collect the text while also streaming it to the client.
          // Use a TransformStream to intercept chunks.
          const sseResponse = toServerSentEventsResponse(stream, {
            abortController,
          })

          const reader = sseResponse.body!.getReader()
          let fullText = ''
          const decoder = new TextDecoder()

          const outputStream = new ReadableStream({
            async pull(controller) {
              const { done, value } = await reader.read()
              if (done) {
                controller.close()

                // Save to cache
                if (fullText) {
                  try {
                    const { env } = await import('cloudflare:workers')
                    const db = (env as Record<string, unknown>).DB as D1Database
                    await db
                      .prepare(
                        'INSERT OR REPLACE INTO game_details_cache (championship_id, content, model) VALUES (?, ?, ?)',
                      )
                      .bind(champId, fullText, 'gpt-4o-mini')
                      .run()
                  } catch {
                    // Cache write failed — not critical
                  }
                }
                return
              }

              // Pass through to client
              controller.enqueue(value)

              // Parse SSE data to extract text content
              const text = decoder.decode(value, { stream: true })
              const lines = text.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const event = JSON.parse(line.slice(6))
                    if (event.type === 'TEXT_MESSAGE_CONTENT' && event.delta) {
                      fullText += event.delta
                    }
                  } catch {
                    // Not JSON or partial — skip
                  }
                }
              }
            },
            cancel() {
              reader.cancel()
            },
          })

          return new Response(outputStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        }

        // No championship_id — just stream directly
        return toServerSentEventsResponse(stream, { abortController })
      },
    },
  },
})
