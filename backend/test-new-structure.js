const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNewStructure() {
  try {
    console.log('Testing new normalized structure...');
    
    // Test 1: Fetch teams with player data
    console.log('\n1. Testing team fetch with player joins...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        *,
        player1:players!player1_id(*),
        player2:players!player2_id(*)
      `)
      .limit(3);
    
    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return;
    }
    
    console.log(`✓ Successfully fetched ${teams.length} teams with player data`);
    teams.forEach((team, index) => {
      console.log(`  Team ${index + 1}: ${team.name}`);
      console.log(`    Player 1: ${team.player1?.first_name} ${team.player1?.last_name}`);
      console.log(`    Player 2: ${team.player2?.first_name} ${team.player2?.last_name}`);
    });
    
    // Test 2: Create a new team (simulating the addTeam function)
    console.log('\n2. Testing team creation...');
    const testPlayer1 = {
      first_name: 'Test',
      last_name: 'Player1',
      phone_number: '5551234567',
      city: 'TestCity'
    };
    
    const testPlayer2 = {
      first_name: 'Test',
      last_name: 'Player2',
      phone_number: '5551234567',
      city: 'TestCity'
    };
    
    // Create or find player1
    const { data: player1Data, error: player1Error } = await supabase
      .from('players')
      .insert([testPlayer1])
      .select()
      .single();
    
    if (player1Error) {
      console.error('Error creating player 1:', player1Error);
      return;
    }
    
    // Create or find player2
    const { data: player2Data, error: player2Error } = await supabase
      .from('players')
      .insert([testPlayer2])
      .select()
      .single();
    
    if (player2Error) {
      console.error('Error creating player 2:', player2Error);
      return;
    }
    
    // Create team
    const teamName = `${testPlayer1.first_name}/${testPlayer2.first_name}`;
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert([{
        name: teamName,
        player1_id: player1Data.id,
        player2_id: player2Data.id
      }])
      .select()
      .single();
    
    if (teamError) {
      console.error('Error creating team:', teamError);
      return;
    }
    
    console.log(`✓ Successfully created team: ${teamName} (ID: ${teamData.id})`);
    
    // Test 3: Fetch the newly created team with player data
    console.log('\n3. Testing fetch of newly created team...');
    const { data: newTeam, error: fetchError } = await supabase
      .from('teams')
      .select(`
        *,
        player1:players!player1_id(*),
        player2:players!player2_id(*)
      `)
      .eq('id', teamData.id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching new team:', fetchError);
      return;
    }
    
    console.log('✓ Successfully fetched new team with player data:');
    console.log(`  Team: ${newTeam.name}`);
    console.log(`  Player 1: ${newTeam.player1?.first_name} ${newTeam.player1?.last_name} (${newTeam.player1?.city})`);
    console.log(`  Player 2: ${newTeam.player2?.first_name} ${newTeam.player2?.last_name} (${newTeam.player2?.city})`);
    
    // Test 4: Clean up test data
    console.log('\n4. Cleaning up test data...');
    await supabase.from('teams').delete().eq('id', teamData.id);
    console.log('✓ Test team deleted');
    
    console.log('\n✅ All tests passed! The new normalized structure is working correctly.');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testNewStructure(); 