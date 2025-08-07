const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateTeamsOnly() {
  try {
    console.log('Migrating teams to new structure...');
    
    // Get existing players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');
    
    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }
    
    console.log(`Found ${players.length} players`);
    
    // Get existing teams
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('*');
    
    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }
    
    console.log(`Found ${existingTeams.length} teams to migrate`);
    
    // Create a map of players by name for easy lookup
    const playerMap = new Map();
    players.forEach(player => {
      const key = `${player.first_name}-${player.last_name}`;
      playerMap.set(key, player);
    });
    
    // Migrate teams one by one
    let successCount = 0;
    let errorCount = 0;
    
    for (const team of existingTeams) {
      const player1FirstName = team.player1_first_name?.trim();
      const player1LastName = team.player1_last_name?.trim() || 'Unknown';
      const player2FirstName = team.player2_first_name?.trim();
      const player2LastName = team.player2_last_name?.trim() || 'Unknown';
      
      if (!player1FirstName || !player2FirstName) {
        console.log(`Skipping team ${team.name}: missing player names`);
        continue;
      }
      
      // Find players
      const player1Key = `${player1FirstName}-${player1LastName}`;
      const player2Key = `${player2FirstName}-${player2LastName}`;
      
      const player1 = playerMap.get(player1Key);
      const player2 = playerMap.get(player2Key);
      
      if (!player1 || !player2) {
        console.log(`Skipping team ${team.name}: player not found`);
        console.log(`  Looking for: ${player1Key}, ${player2Key}`);
        continue;
      }
      
      // Create team name
      const teamName = `${player1FirstName}/${player2FirstName}`;
      
      // Insert team
      const { data: newTeam, error: insertError } = await supabase
        .from('teams_new')
        .insert([{
          name: teamName,
          player1_id: player1.id,
          player2_id: player2.id
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error(`Error inserting team ${teamName}:`, insertError);
        errorCount++;
      } else {
        console.log(`✓ Created team: ${teamName}`);
        successCount++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`- Teams created: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Show sample of new teams
    const { data: sampleTeams } = await supabase
      .from('teams_new')
      .select(`
        name,
        player1:players!teams_new_player1_id_fkey(first_name, last_name),
        player2:players!teams_new_player2_id_fkey(first_name, last_name)
      `)
      .limit(5);
    
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
migrateTeamsOnly(); 