const { createClient } = require('@supabase/supabase-js');

// Get environment variables directly
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
  console.error('Current values:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '***' : 'not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayerTournament() {
  console.log('=== Checking player_tournament table ===');
  
  try {
    // Test 1: Get all records first
    const { data: allPlayerTournament, error: ptError } = await supabase
      .from('player_tournament')
      .select('*');

    if (ptError) {
      console.error('Error accessing player_tournament table:', ptError);
      return;
    }

    console.log('Total records in player_tournament table:', allPlayerTournament?.length || 0);
    
    if (allPlayerTournament && allPlayerTournament.length > 0) {
      console.log('Sample records:', allPlayerTournament.slice(0, 3));
      
      // Test 2: Check data types
      const sampleRecord = allPlayerTournament[0];
      console.log('Sample record tournament_id type:', typeof sampleRecord.tournament_id);
      console.log('Sample record tournament_id value:', sampleRecord.tournament_id);
      
      // Test 3: Try different query approaches
      console.log('\n=== Testing different query approaches ===');
      
      // Test with string '3'
      const { data: test1, error: error1 } = await supabase
        .from('player_tournament')
        .select('player_id')
        .eq('tournament_id', '3');
      console.log('Query with string "3":', test1?.length || 0, 'records');
      
      // Test with number 3
      const { data: test2, error: error2 } = await supabase
        .from('player_tournament')
        .select('player_id')
        .eq('tournament_id', 3);
      console.log('Query with number 3:', test2?.length || 0, 'records');
      
      // Test with filter in JavaScript
      const tournament3Records = allPlayerTournament.filter(pt => pt.tournament_id === '3');
      console.log('JavaScript filter with string "3":', tournament3Records.length, 'records');
      
      const tournament3RecordsNum = allPlayerTournament.filter(pt => pt.tournament_id === 3);
      console.log('JavaScript filter with number 3:', tournament3RecordsNum.length, 'records');
      
      // Test 4: Check if there are any records with tournament_id 3
      const hasTournament3 = allPlayerTournament.some(pt => pt.tournament_id === '3');
      console.log('Has tournament_id "3":', hasTournament3);
      
      if (tournament3Records.length > 0) {
        console.log('Sample records for tournament 3:', tournament3Records.slice(0, 3));
      }
    } else {
      console.log('player_tournament table is empty!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkPlayerTournament(); 