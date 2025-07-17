const express = require("express");
const cors = require("cors");
const { getDB, initDB } = require("./db");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

initDB();

app.post("/api/login", (req, res) => {
  const db = getDB();
  const { phone } = req.body;
  db.get("SELECT * FROM teams WHERE phone = ?", [phone], (err, team) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  });
});

app.get("/api/tournaments", (req, res) => {
  const db = getDB();
  db.all("SELECT * FROM tournaments", [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/tournaments/:id/teams", (req, res) => {
  const db = getDB();
  db.all(
    `SELECT teams.* FROM teams
      JOIN tournament_teams ON teams.id = tournament_teams.team_id
      WHERE tournament_teams.tournament_id = ?`,
    [req.params.id],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/tournaments/:id/teams", (req, res) => {
  const db = getDB();
  const { team_id } = req.body;
  db.run(
    "INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)",
    [req.params.id, team_id],
    function (err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Add other endpoints for games and stats as needed

app.listen(PORT, () =>
  console.log(`BidWhist API running at http://localhost:${PORT}`)
);
