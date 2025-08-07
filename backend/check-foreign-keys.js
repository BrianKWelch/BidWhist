const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkForeignKeys() {
  try {
    console.log('Checking foreign key relationships...');
    
    // Test 1: Try different foreign key naming patterns
    const patterns = [
      'player1:players!teams_player1_id_fkey(*)',
      'player1:players!player1_id(*)',
      'player1:players(*)',
      'player1:players!teams_player1_id_fkey(first_name, last_name)',
      'player1:players!player1_id(first_name, last_name)',
      'player1:players(first_name, last_name)'
    ];
    
    for (const pattern of patterns) {
      console.log(`\nTrying pattern: ${pattern}`);
      const { data, error } = await supabase
        .from('teams')
        .select(`*, ${pattern}`)
        .limit(1);
      
      if (error) {
        console.log(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Success! Found ${data.length} teams`);
        if (data.length > 0) {
          console.log(`  Sample data:`, JSON.stringify(data[0], null, 2));
        }
        break;
      }
    }
    
    // Test 2: Check if we can fetch teams and players separately
    console.log('\n2. Testing separate fetches...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(3);
    
    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
    } else {
      console.log(`✓ Successfully fetched ${teams.length} teams`);
      console.log('Sample team:', teams[0]);
    }
    
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .limit(3);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
    } else {
      console.log(`✓ Successfully fetched ${players.length} players`);
      console.log('Sample player:', players[0]);
    }
    
  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkForeignKeys(); 