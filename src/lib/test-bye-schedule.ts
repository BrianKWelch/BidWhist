import { generateNRoundsWithByeAndFinal } from './scheduler';

const teams = [
  { id: '1', name: 'Team 1', city: 'A' },
  { id: '2', name: 'Team 2', city: 'B' },
  { id: '3', name: 'Team 3', city: 'A' },
  { id: '4', name: 'Team 4', city: 'C' },
  { id: '5', name: 'Team 5', city: 'B' },
];

const numRounds = 4;

const schedule = generateNRoundsWithByeAndFinal(teams, numRounds);

console.log('Schedule:');
schedule.forEach((round, i) => {
  console.log(`Round ${i + 1}`);
  round.forEach(match => {
    if ('isBye' in match && match.isBye) {
      console.log(`  BYE: ${match.team.name}`);
    } else if ('teamA' in match && 'teamB' in match) {
      console.log(`  ${match.teamA.name} vs ${match.teamB.name}`);
    }
  });
});
