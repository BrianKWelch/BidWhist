const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://awfupnyqnmkhhihjwtjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZnVwbnlxbm1raGhpaGp3dGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODY2OTgsImV4cCI6MjA2ODM2MjY5OH0.ThT4hwPe9mddo8GV8rE3nDueRHKttHaYp7S676JUREg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTeamsStructure() {
  try {
    console.log('Checking teams table structure...');
    
    // Fetch a few teams to see the structure
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .limit(5);
    
    if (error) {
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }
    
    console.log(`Found ${teams.length} teams`);
    
    if (teams.length > 0) {
      console.log('\nTeam structure:');
      const firstTeam = teams[0];
      Object.keys(firstTeam).forEach(key => {
        console.log(`- ${key}: ${typeof firstTeam[key]} = ${JSON.stringify(firstTeam[key])}`);
      });
      
      console.log('\nSample teams:');
      teams.forEach((team, index) => {
        console.log(`\nTeam ${index + 1}:`);
        Object.entries(team).forEach(([key, value]) => {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkTeamsStructure(); 