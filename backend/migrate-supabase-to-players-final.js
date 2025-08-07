const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateSupabaseToPlayersFinal() {
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
    
    // 2. Extract unique players from teams (with data validation)
    const players = new Map(); // Use Map to avoid duplicates
    const teamMappings = []; // Store team data for later processing
    const skippedTeams = []; // Track teams that can't be migrated
    
    existingTeams.forEach(team => {
      // Validate player data using correct column names
      const player1FirstName = team.player1_first_name?.trim();
      const player1LastName = team.player1_last_name?.trim() || 'Unknown'; // Default if empty
      const player2FirstName = team.player2_first_name?.trim();
      const player2LastName = team.player2_last_name?.trim() || 'Unknown'; // Default if empty
      const phoneNumber = team.phone_number?.trim();
      const city = team.city?.trim();
      
      // Skip teams with invalid player data
      if (!player1FirstName || !player2FirstName) {
        skippedTeams.push({
          team: team,
          reason: 'Missing player first names'
        });
        return;
      }
      
      // Create player1 record
      const player1Key = `${player1FirstName}-${player1LastName}-${phoneNumber || 'unknown'}`;
      if (!players.has(player1Key)) {
        players.set(player1Key, {
          first_name: player1FirstName,
          last_name: player1LastName,
          phone_number: phoneNumber || null,
          city: city || null
        });
      }
      
      // Create player2 record
      const player2Key = `${player2FirstName}-${player2LastName}-${phoneNumber || 'unknown'}`;
      if (!players.has(player2Key)) {
        players.set(player2Key, {
          first_name: player2FirstName,
          last_name: player2LastName,
          phone_number: phoneNumber || null,
          city: city || null
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
    console.log(`Skipped ${skippedTeams.length} teams due to invalid data`);
    
    if (skippedTeams.length > 0) {
      console.log('\nSkipped teams:');
      skippedTeams.forEach(skip => {
        console.log(`- ${skip.team.name || 'Unknown'}: ${skip.reason}`);
      });
    }
    
    // 3. Insert players into database
    const playerIds = new Map(); // Map player key to database ID
    const playersArray = Array.from(players.values());
    
    console.log('\nInserting players...');
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
               (phone === playerData.phone_number || (phone === 'unknown' && !playerData.phone_number));
      });
      
      if (playerKey) {
        playerIds.set(playerKey, player.id);
      }
    }
    
    console.log(`Inserted ${playerIds.size} players`);
    
    // 4. Create new teams with player references
    console.log('\nCreating new teams...');
    const newTeams = [];
    
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
      
      newTeams.push({
        name: teamName,
        player1_id: player1Id,
        player2_id: player2Id
      });
      
      console.log(`Prepared team: ${teamName}`);
    }
    
    // 5. Insert all new teams at once
    if (newTeams.length > 0) {
      console.log(`\nInserting ${newTeams.length} teams...`);
      const { data: insertedTeams, error: teamInsertError } = await supabase
        .from('teams_new')
        .insert(newTeams)
        .select();
      
      if (teamInsertError) {
        console.error('Error inserting teams:', teamInsertError);
      } else {
        console.log(`Successfully inserted ${insertedTeams.length} teams`);
      }
    }
    
    console.log('\nMigration completed!');
    console.log('Summary:');
    console.log(`- Total teams processed: ${existingTeams.length}`);
    console.log(`- Teams migrated: ${newTeams.length}`);
    console.log(`- Teams skipped: ${skippedTeams.length}`);
    console.log(`- Unique players created: ${playerIds.size}`);
    
    console.log('\nNext steps:');
    console.log('1. Review the new teams_new table in Supabase');
    console.log('2. If everything looks correct, manually rename tables:');
    console.log('   - Rename "teams" to "teams_old"');
    console.log('   - Rename "teams_new" to "teams"');
    console.log('3. Update your app code to use the new structure');
    
    // Show sample data
    const { data: samplePlayers } = await supabase
      .from('players')
      .select('*')
      .limit(5);
    
    if (samplePlayers) {
      console.log('\nSample players:');
      samplePlayers.forEach(player => {
        console.log(`- ${player.first_name} ${player.last_name} (${player.city || 'No city'})`);
      });
    }
    
    const { data: sampleTeams } = await supabase
      .from('teams_new')
      .select(`
        name,
        player1:players!teams_new_player1_id_fkey(first_name, last_name),
        player2:players!teams_new_player2_id_fkey(first_name, last_name)
      `)
      .limit(3);
    
    if (sampleTeams) {
      console.log('\nSample new teams:');
      sampleTeams.forEach(team => {
        console.log(`- ${team.name}: ${team.player1.first_name} ${team.player1.last_name} & ${team.player2.first_name} ${team.player2.last_name}`);
      });
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateSupabaseToPlayersFinal(); 