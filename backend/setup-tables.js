const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupTables() {
  try {
    console.log('Setting up table structure in Supabase...');
    
    // Check if players table exists
    console.log('Checking players table...');
    const { data: playersCheck, error: playersError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    if (playersError && playersError.code === 'PGRST116') {
      console.log('Players table does not exist. You need to create it manually in Supabase dashboard.');
      console.log('SQL to create players table:');
      console.log(`
CREATE TABLE players (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    } else {
      console.log('Players table exists ✓');
    }
    
    // Check if teams_new table exists
    console.log('Checking teams_new table...');
    const { data: teamsNewCheck, error: teamsNewError } = await supabase
      .from('teams_new')
      .select('*')
      .limit(1);
    
    if (teamsNewError && teamsNewError.code === 'PGRST116') {
      console.log('Teams_new table does not exist. You need to create it manually in Supabase dashboard.');
      console.log('SQL to create teams_new table:');
      console.log(`
CREATE TABLE teams_new (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  player1_id BIGINT REFERENCES players(id),
  player2_id BIGINT REFERENCES players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    } else {
      console.log('Teams_new table exists ✓');
    }
    
    console.log('\nTo complete the setup:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the CREATE TABLE statements above');
    console.log('4. Then run the migration script again');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the setup
setupTables(); 