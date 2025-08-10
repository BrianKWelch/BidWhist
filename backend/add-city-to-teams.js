const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addCityToTeams() {
  try {
    console.log('Populating city field in teams table...');
    
    // Get all teams with player data
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        *,
        player1:players!player1_id(*),
        player2:players!player2_id(*)
      `);
    
    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }
    
    console.log(`Found ${teams.length} teams to update`);
    
    // Update each team with player1's city
    let successCount = 0;
    let errorCount = 0;
    
    for (const team of teams) {
      const city = team.player1?.city || team.player2?.city || '';
      
      const { error: updateError } = await supabase
        .from('teams')
        .update({ city })
        .eq('id', team.id);
      
      if (updateError) {
        console.error(`Error updating team ${team.id}:`, updateError);
        errorCount++;
      } else {
        console.log(`✓ Updated team ${team.name} with city: ${city}`);
        successCount++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`- Teams updated: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    
    // Show sample of updated teams
    const { data: sampleTeams } = await supabase
      .from('teams')
      .select('id, name, city')
      .limit(5);
    
    console.log('\nSample updated teams:');
    sampleTeams?.forEach(team => {
      console.log(`- ${team.name}: ${team.city || 'No city'}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
addCityToTeams();

