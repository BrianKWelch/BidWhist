const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./bidwhist.sqlite');
const data = JSON.parse(fs.readFileSync('localstorage-export.json', 'utf8'));

db.serialize(() => {
  // 1. Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      teamNumber INTEGER,
      name TEXT,
      player1FirstName TEXT,
      player1LastName TEXT,
      player2FirstName TEXT,
      player2LastName TEXT,
      phoneNumber TEXT,
      city TEXT,
      registeredTournaments TEXT,
      bostonPotTournaments TEXT,
      bostonPotOptOut TEXT,
      paymentStatus TEXT,
      player1PaymentStatus TEXT,
      player2PaymentStatus TEXT,
      player1TournamentPayments TEXT,
      player2TournamentPayments TEXT,
      tournamentPayments TEXT,
      totalOwed REAL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT,
      date TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id TEXT,
      team_id TEXT
    )
  `);

  // 2. Insert teams
  if (data.teams) {
    data.teams.forEach(team => {
      db.run(`
        INSERT OR REPLACE INTO teams (
          id, teamNumber, name, player1FirstName, player1LastName,
          player2FirstName, player2LastName, phoneNumber, city,
          registeredTournaments, bostonPotTournaments, bostonPotOptOut,
          paymentStatus, player1PaymentStatus, player2PaymentStatus,
          player1TournamentPayments, player2TournamentPayments, tournamentPayments, totalOwed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        team.id,
        team.teamNumber,
        team.name,
        team.player1FirstName,
        team.player1LastName,
        team.player2FirstName,
        team.player2LastName,
        team.phoneNumber,
        team.city,
        JSON.stringify(team.registeredTournaments || []),
        JSON.stringify(team.bostonPotTournaments || []),
        JSON.stringify(team.bostonPotOptOut || {}),
        team.paymentStatus || null,
        team.player1PaymentStatus || null,
        team.player2PaymentStatus || null,
        JSON.stringify(team.player1TournamentPayments || {}),
        JSON.stringify(team.player2TournamentPayments || {}),
        JSON.stringify(team.tournamentPayments || {}),
        team.totalOwed || 0
      ]);
    });
    console.log(`Inserted ${data.teams.length} teams`);
  }

  // 3. Insert tournaments
  if (data.tournaments) {
    data.tournaments.forEach(t => {
      db.run(`
        INSERT OR REPLACE INTO tournaments (
          id, name, date
        ) VALUES (?, ?, ?)
      `, [
        t.id,
        t.name,
        t.date
      ]);
    });
    console.log(`Inserted ${data.tournaments.length} tournaments`);
  }

  // 4. Insert tournament-team links
  if (data.teams) {
    data.teams.forEach(team => {
      (team.registeredTournaments || []).forEach(tournamentId => {
        db.run(`
          INSERT INTO tournament_teams (tournament_id, team_id)
          VALUES (?, ?)
        `, [tournamentId, team.id]);
      });
    });
    console.log(`Linked teams to tournaments`);
  }
});

db.close();
