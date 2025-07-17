const sqlite3 = require('sqlite3').verbose();

function getDB() {
  return new sqlite3.Database('./bidwhist.sqlite');
}

function initDB() {
  const db = getDB();
  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      date TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      city TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER,
      team_id INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER,
      round INTEGER,
      table_num INTEGER,
      team1_id INTEGER,
      team2_id INTEGER,
      score1 INTEGER,
      score2 INTEGER
    )
  `);
  db.close();
}

module.exports = { getDB, initDB };
