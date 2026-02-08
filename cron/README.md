# ring-count-cron

Daily Cloudflare Worker that checks ESPN for completed championship games and inserts new results into D1.

## Setup

```bash
cd cron
npm install
```

## Deploy

```bash
npm run deploy
# or from project root:
npm run deploy:cron
```

After the first deploy, note the workers.dev URL in the output (e.g., `https://ring-count-cron.<subdomain>.workers.dev`). Update the `cron:trigger` script in the root `package.json` with this URL.

## Schedule

Runs daily at midnight EST (5:00 AM UTC). During daylight saving time (EDT), this shifts to 1:00 AM.

## Manual trigger

If a late-night game finishes after the cron already ran:

```bash
curl https://ring-count-cron.<subdomain>.workers.dev
```

Or from the project root (after updating the URL in package.json):

```bash
npm run cron:trigger
```

## Monitor logs

Live tail:

```bash
npm run tail
# or from project root:
npm run cron:tail
```

Historical logs are available in the Cloudflare dashboard under **Workers & Pages > ring-count-cron > Logs**.

## How it works

1. Fetches ESPN scoreboard API (`seasontype=3`) with a 7-day lookback for each league
2. Filters events by keyword (e.g., "Super Bowl", "World Series")
3. For single-game sports (NFL, CFB, CBB): checks `status.type.completed`, extracts winner/loser/scores
4. For series sports (MLB, NBA, NHL): checks `series.completed`, parses series summary for win counts
5. Matches ESPN team IDs to DB team IDs via `teams.espn_id` + `teams.league`
6. Deduplicates on `league + year + game_title` before inserting
7. Each league is processed independently -- one failure doesn't block others

## Leagues

| League | ESPN Endpoint                      | Game Title                | Score Type        |
| ------ | ---------------------------------- | ------------------------- | ----------------- |
| NFL    | football/nfl                       | Super Bowl LXX            | Game score        |
| MLB    | baseball/mlb                       | World Series              | Series wins (4-2) |
| NBA    | basketball/nba                     | NBA Finals                | Series wins (4-1) |
| NHL    | hockey/nhl                         | Stanley Cup Finals        | Series wins (4-3) |
| CFB    | football/college-football          | CFP National Championship | Game score        |
| CBB    | basketball/mens-college-basketball | NCAA Championship Game    | Game score        |
