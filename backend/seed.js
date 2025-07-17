const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bidwhist.sqlite');

db.serialize(() => {
  // 1. Create tables (if not exist)
  db.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    city TEXT
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

          // 4. Seed teams and link them to both tournaments
          const teams = [
            { name: "Detroit Stars", phone: "3130000001", city: "Detroit" },
            { name: "Chicago Kings", phone: "3120000002", city: "Chicago" },
            { name: "Cleveland Aces", phone: "2160000003", city: "Cleveland" },
            { name: "Milwaukee Jokers", phone: "4140000004", city: "Milwaukee" },
            { name: "St. Louis Slams", phone: "3140000005", city: "St. Louis" },
            { name: "Minneapolis Sharks", phone: "6120000006", city: "Minneapolis" },
            { name: "Kansas City Queens", phone: "8160000007", city: "Kansas City" },
            { name: "Indianapolis Hoosiers", phone: "3170000008", city: "Indianapolis" }
          ];

          let completed = 0;
          teams.forEach(tm => {
            db.run(
              `INSERT INTO teams (name, phone, city) VALUES (?, ?, ?)`,
              [tm.name, tm.phone, tm.city],
              function () {
                const teamId = this.lastID;
                db.run(`INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)`, [fridayId, teamId]);
                db.run(`INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)`, [saturdayId, teamId], () => {
                  completed++;
                  if (completed === teams.length) {
                    console.log("Seeded tournaments and 8 teams!");
                    db.close();
                  }
                });
              }
            );
          });
        }
      );
    }
  );
});
