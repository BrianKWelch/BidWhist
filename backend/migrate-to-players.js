const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Read the localStorage export to get current team data
const localStorageData = JSON.parse(fs.readFileSync('./localstorage-export.json', 'utf8'));

function migrateToPlayers() {
  const db = new sqlite3.Database('./bidwhist.sqlite');
  
  db.serialize(() => {
    console.log('Starting migration to normalized players/teams structure...');
    
    // 1. Create new players table
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone_number TEXT,
        city TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating players table:', err);
        return;
      }
      console.log('Created players table');
    });

    // 2. Create new teams table structure
    db.run(`
      CREATE TABLE IF NOT EXISTS teams_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        player1_id INTEGER,
        player2_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player1_id) REFERENCES players (id),
        FOREIGN KEY (player2_id) REFERENCES players (id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating new teams table:', err);
        return;
      }
      console.log('Created new teams table structure');
    });

    // 3. Extract unique players from localStorage data
    const players = new Map(); // Use Map to avoid duplicates
    const teamMappings = new Map(); // Map old team ID to new structure

    if (localStorageData.teams) {
      localStorageData.teams.forEach(team => {
        // Create player1 record
        const player1Key = `${team.player1FirstName}-${team.player1LastName}-${team.phoneNumber}`;
        if (!players.has(player1Key)) {
          players.set(player1Key, {
            first_name: team.player1FirstName,
            last_name: team.player1LastName,
            phone_number: team.phoneNumber,
            city: team.city
          });
        }

        // Create player2 record
        const player2Key = `${team.player2FirstName}-${team.player2LastName}-${team.phoneNumber}`;
        if (!players.has(player2Key)) {
          players.set(player2Key, {
            first_name: team.player2FirstName,
            last_name: team.player2LastName,
            phone_number: team.phoneNumber,
            city: team.city
          });
        }

        // Store team mapping for later
        teamMappings.set(team.id, {
          oldTeam: team,
          player1Key,
          player2Key
        });
      });
    }

    console.log(`Found ${players.size} unique players`);

    // 4. Insert players into database
    const playerIds = new Map(); // Map player key to database ID
    let playersInserted = 0;
    const totalPlayers = players.size;

    players.forEach((playerData, playerKey) => {
      db.run(
        `INSERT INTO players (first_name, last_name, phone_number, city) VALUES (?, ?, ?, ?)`,
        [playerData.first_name, playerData.last_name, playerData.phone_number, playerData.city],
        function(err) {
          if (err) {
            console.error('Error inserting player:', err);
            return;
          }
          playerIds.set(playerKey, this.lastID);
          playersInserted++;
          
          if (playersInserted === totalPlayers) {
            console.log('All players inserted, now creating teams...');
            createTeams();
          }
        }
      );
    });

    function createTeams() {
      // 5. Create new teams with player references
      let teamsCreated = 0;
      const totalTeams = teamMappings.size;

      teamMappings.forEach((mapping, oldTeamId) => {
        const player1Id = playerIds.get(mapping.player1Key);
        const player2Id = playerIds.get(mapping.player2Key);
        const teamName = mapping.oldTeam.name;

        db.run(
          `INSERT INTO teams_new (name, player1_id, player2_id) VALUES (?, ?, ?)`,
          [teamName, player1Id, player2Id],
          function(err) {
            if (err) {
              console.error('Error inserting team:', err);
              return;
            }
            teamsCreated++;
            console.log(`Created team: ${teamName} (ID: ${this.lastID})`);
            
            if (teamsCreated === totalTeams) {
              console.log('All teams created, finalizing migration...');
              finalizeMigration();
            }
          }
        );
      });
    }

    function finalizeMigration() {
      // 6. Backup old teams table and replace with new one
      db.run(`ALTER TABLE teams RENAME TO teams_old`, (err) => {
        if (err) {
          console.error('Error renaming old teams table:', err);
          return;
        }
        
        db.run(`ALTER TABLE teams_new RENAME TO teams`, (err) => {
          if (err) {
            console.error('Error renaming new teams table:', err);
            return;
          }
          
          console.log('Migration completed successfully!');
          console.log('Old teams table backed up as teams_old');
          console.log('New structure:');
          console.log('- players table: individual player records');
          console.log('- teams table: references to player IDs');
          
          // Show some sample data
          db.all(`SELECT * FROM players LIMIT 5`, (err, rows) => {
            if (!err) {
              console.log('\nSample players:');
              rows.forEach(row => {
                console.log(`- ${row.first_name} ${row.last_name} (${row.city})`);
              });
            }
            
            db.all(`SELECT t.name, p1.first_name || ' ' || p1.last_name as player1, p2.first_name || ' ' || p2.last_name as player2 FROM teams t JOIN players p1 ON t.player1_id = p1.id JOIN players p2 ON t.player2_id = p2.id LIMIT 3`, (err, rows) => {
              if (!err) {
                console.log('\nSample teams:');
                rows.forEach(row => {
                  console.log(`- ${row.name}: ${row.player1} & ${row.player2}`);
                });
              }
              db.close();
            });
          });
        });
      });
    }
  });
}

// Run the migration
migrateToPlayers(); 