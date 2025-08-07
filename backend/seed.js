const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bidwhist.sqlite');

db.serialize(() => {
  // 1. Create tables (if not exist)
  db.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    city TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    player1_id INTEGER,
    player2_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES players (id),
    FOREIGN KEY (player2_id) REFERENCES players (id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS tournament_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER,
    team_id INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER,
    round INTEGER,
    table_num INTEGER,
    team1_id INTEGER,
    team2_id INTEGER,
    score1 INTEGER,
    score2 INTEGER
  )`);

  // 2. Clean out tables for reseed (optional)
  db.run(`DELETE FROM tournament_teams`);
  db.run(`DELETE FROM teams`);
  db.run(`DELETE FROM players`);
  db.run(`DELETE FROM tournaments`);
  db.run(`DELETE FROM games`);

  // 3. Seed tournaments
  db.run(
    `INSERT INTO tournaments (name, date) VALUES (?, ?)`,
    ["Friday Night", "2025-07-18"],
    function () {
      const fridayId = this.lastID;

      db.run(
        `INSERT INTO tournaments (name, date) VALUES (?, ?)`,
        ["Saturday Showdown", "2025-07-19"],
        function () {
          const saturdayId = this.lastID;

          // 4. Seed players first
          const players = [
            { first_name: "John", last_name: "Smith", phone_number: "3130000001", city: "Detroit" },
            { first_name: "Mike", last_name: "Johnson", phone_number: "3130000001", city: "Detroit" },
            { first_name: "Sarah", last_name: "Davis", phone_number: "3120000002", city: "Chicago" },
            { first_name: "Tom", last_name: "Wilson", phone_number: "3120000002", city: "Chicago" },
            { first_name: "David", last_name: "Brown", phone_number: "2160000003", city: "Cleveland" },
            { first_name: "Lisa", last_name: "Taylor", phone_number: "2160000003", city: "Cleveland" },
            { first_name: "Chris", last_name: "Miller", phone_number: "4140000004", city: "Milwaukee" },
            { first_name: "Amy", last_name: "Anderson", phone_number: "4140000004", city: "Milwaukee" },
            { first_name: "Carlos", last_name: "Garcia", phone_number: "3140000005", city: "St. Louis" },
            { first_name: "Maria", last_name: "Rodriguez", phone_number: "3140000005", city: "St. Louis" },
            { first_name: "Kevin", last_name: "Lee", phone_number: "6120000006", city: "Minneapolis" },
            { first_name: "Jennifer", last_name: "White", phone_number: "6120000006", city: "Minneapolis" },
            { first_name: "Ryan", last_name: "Clark", phone_number: "8160000007", city: "Kansas City" },
            { first_name: "Emily", last_name: "Hall", phone_number: "8160000007", city: "Kansas City" },
            { first_name: "Mark", last_name: "Hall", phone_number: "3170000008", city: "Indianapolis" },
            { first_name: "Jessica", last_name: "Young", phone_number: "3170000008", city: "Indianapolis" }
          ];

          let playersInserted = 0;
          const playerIds = [];

          players.forEach(player => {
            db.run(
              `INSERT INTO players (first_name, last_name, phone_number, city) VALUES (?, ?, ?, ?)`,
              [player.first_name, player.last_name, player.phone_number, player.city],
              function () {
                playerIds.push(this.lastID);
                playersInserted++;
                
                if (playersInserted === players.length) {
                  console.log("All players inserted, now creating teams...");
                  createTeams();
                }
              }
            );
          });

          function createTeams() {
            // 5. Create teams from player pairs
            const teams = [
              { name: "Detroit Stars", player1_id: playerIds[0], player2_id: playerIds[1] },
              { name: "Chicago Kings", player1_id: playerIds[2], player2_id: playerIds[3] },
              { name: "Cleveland Aces", player1_id: playerIds[4], player2_id: playerIds[5] },
              { name: "Milwaukee Jokers", player1_id: playerIds[6], player2_id: playerIds[7] },
              { name: "St. Louis Slams", player1_id: playerIds[8], player2_id: playerIds[9] },
              { name: "Minneapolis Sharks", player1_id: playerIds[10], player2_id: playerIds[11] },
              { name: "Kansas City Queens", player1_id: playerIds[12], player2_id: playerIds[13] },
              { name: "Indianapolis Hoosiers", player1_id: playerIds[14], player2_id: playerIds[15] }
            ];

            let teamsCreated = 0;
            teams.forEach(team => {
              db.run(
                `INSERT INTO teams (name, player1_id, player2_id) VALUES (?, ?, ?)`,
                [team.name, team.player1_id, team.player2_id],
                function () {
                  const teamId = this.lastID;
                  // Link team to both tournaments
                  db.run(`INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)`, [fridayId, teamId]);
                  db.run(`INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)`, [saturdayId, teamId], () => {
                    teamsCreated++;
                    if (teamsCreated === teams.length) {
                      console.log("Seeded tournaments, players, and teams!");
                      db.close();
                    }
                  });
                }
              );
            });
          }
        }
      );
    }
  );
});
