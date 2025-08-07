const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateSupabaseToPlayers() {
  try {
    console.log('Starting Supabase migration to normalized players/teams structure...');
    
    // 1. Fetch all existing teams from Supabase
    console.log('Fetching existing teams...');
    const { data: existingTeams, error: fetchError } = await supabase
      .from('teams')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Failed to fetch teams: ${fetchError.message}`);
    }
    
    console.log(`Found ${existingTeams.length} teams to migrate`);
    
    // 2. Extract unique players from teams
    const players = new Map(); // Use Map to avoid duplicates
    const teamMappings = []; // Store team data for later processing
    
    existingTeams.forEach(team => {
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
      teamMappings.push({
        oldTeam: team,
        player1Key,
        player2Key
      });
    });
    
    console.log(`Found ${players.size} unique players`);
    
    // 3. Create players table if it doesn't exist
    console.log('Creating players table...');
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS players (
          id BIGSERIAL PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          phone_number TEXT,
          city TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (createTableError) {
      console.log('Players table may already exist, continuing...');
    }
    
    // 4. Insert players into database
    const playerIds = new Map(); // Map player key to database ID
    const playersArray = Array.from(players.values());
    
    console.log('Inserting players...');
    for (const playerData of playersArray) {
      const { data: player, error: insertError } = await supabase
        .from('players')
        .insert([playerData])
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting player:', insertError);
        continue;
      }
      
      // Find the key for this player
      const playerKey = Array.from(players.keys()).find(key => {
        const [firstName, lastName, phone] = key.split('-');
        return firstName === playerData.first_name && 
               lastName === playerData.last_name && 
               phone === playerData.phone_number;
      });
      
      if (playerKey) {
        playerIds.set(playerKey, player.id);
      }
    }
    
    console.log(`Inserted ${playerIds.size} players`);
    
    // 5. Create new teams table structure
    console.log('Creating new teams table structure...');
    const { error: createTeamsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS teams_new (
          id BIGSERIAL PRIMARY KEY,
          name TEXT,
          player1_id BIGINT REFERENCES players(id),
          player2_id BIGINT REFERENCES players(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (createTeamsTableError) {
      console.log('New teams table may already exist, continuing...');
    }
    
    // 6. Create new teams with player references
    console.log('Creating new teams...');
    for (const mapping of teamMappings) {
      const player1Id = playerIds.get(mapping.player1Key);
      const player2Id = playerIds.get(mapping.player2Key);
      
      if (!player1Id || !player2Id) {
        console.error('Missing player IDs for team:', mapping.oldTeam.name);
        continue;
      }
      
      // Generate team name as "FirstName/FirstName"
      const player1 = players.get(mapping.player1Key);
      const player2 = players.get(mapping.player2Key);
      const teamName = `${player1.first_name}/${player2.first_name}`;
      
      const { error: teamInsertError } = await supabase
        .from('teams_new')
        .insert([{
          name: teamName,
          player1_id: player1Id,
          player2_id: player2Id
        }]);
      
      if (teamInsertError) {
        console.error('Error inserting team:', teamInsertError);
        continue;
      }
      
      console.log(`Created team: ${teamName}`);
    }
    
    // 7. Backup old teams table and replace with new one
    console.log('Finalizing migration...');
    const { error: backupError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE teams RENAME TO teams_old;'
    });
    
    if (backupError) {
      console.error('Error backing up old teams table:', backupError);
    }
    
    const { error: renameError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE teams_new RENAME TO teams;'
    });
    
    if (renameError) {
      console.error('Error renaming new teams table:', renameError);
    }
    
    console.log('Migration completed successfully!');
    console.log('Old teams table backed up as teams_old');
    console.log('New structure:');
    console.log('- players table: individual player records');
    console.log('- teams table: references to player IDs with auto-generated names');
    
    // Show sample data
    const { data: samplePlayers } = await supabase
      .from('players')
      .select('*')
      .limit(5);
    
    if (samplePlayers) {
      console.log('\nSample players:');
      samplePlayers.forEach(player => {
        console.log(`- ${player.first_name} ${player.last_name} (${player.city})`);
      });
    }
    
    const { data: sampleTeams } = await supabase
      .from('teams')
      .select(`
        name,
        player1:players!teams_player1_id_fkey(first_name, last_name),
        player2:players!teams_player2_id_fkey(first_name, last_name)
      `)
      .limit(3);
    
    if (sampleTeams) {
      console.log('\nSample teams:');
      sampleTeams.forEach(team => {
        console.log(`- ${team.name}: ${team.player1.first_name} ${team.player1.last_name} & ${team.player2.first_name} ${team.player2.last_name}`);
      });
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateSupabaseToPlayers(); 