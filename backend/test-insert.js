const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  try {
    console.log('Testing insert into teams_new table...');
    
    // First, let's see what's in the table
    const { data: existing, error: selectError } = await supabase
      .from('teams_new')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('Error selecting from teams_new:', selectError);
    } else {
      console.log('Current teams_new table has', existing.length, 'rows');
    }
    
    // Get a player to reference
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .limit(2);
    
    if (playersError) {
      console.error('Error getting players:', playersError);
      return;
    }
    
    if (players.length < 2) {
      console.error('Need at least 2 players to test');
      return;
    }
    
    console.log('Testing with players:', players[0].first_name, 'and', players[1].first_name);
    
    // Try to insert a test team
    const { data: newTeam, error: insertError } = await supabase
      .from('teams_new')
      .insert([{
        name: 'Test/Team',
        player1_id: players[0].id,
        player2_id: players[1].id
      }])
      .select();
    
    if (insertError) {
      console.error('Insert error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('✓ Successfully inserted test team:', newTeam);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testInsert(); 