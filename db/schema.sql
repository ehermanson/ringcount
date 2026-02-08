DROP TABLE IF EXISTS championships;
DROP TABLE IF EXISTS teams;

CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  league TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  espn_id TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#333333',
  secondary_color TEXT NOT NULL DEFAULT '#FFFFFF'
);

CREATE TABLE championships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  league TEXT NOT NULL,
  winning_team_id INTEGER,
  winning_team_display_name TEXT NOT NULL,
  losing_team_id INTEGER,
  losing_team_display_name TEXT,
  winning_score INTEGER,
  losing_score INTEGER,
  game_title TEXT NOT NULL,
  championship_date TEXT,
  FOREIGN KEY (winning_team_id) REFERENCES teams(id)
);

CREATE INDEX idx_championships_year ON championships(year);
CREATE INDEX idx_championships_winning_team ON championships(winning_team_id);
CREATE INDEX idx_championships_league ON championships(league);
