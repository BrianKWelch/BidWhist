"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var scheduler_1 = require("./scheduler");
var teams = [
    { id: '1', name: 'Team 1', city: 'A' },
    { id: '2', name: 'Team 2', city: 'B' },
    { id: '3', name: 'Team 3', city: 'A' },
    { id: '4', name: 'Team 4', city: 'C' },
    { id: '5', name: 'Team 5', city: 'B' },
];
var numRounds = 4;
var schedule = (0, scheduler_1.generateNRoundsWithByeAndFinal)(teams, numRounds);
console.log('Schedule:');
schedule.forEach(function (round, i) {
    console.log("Round ".concat(i + 1));
    round.forEach(function (match) {
        if ('isBye' in match && match.isBye) {
            console.log("  BYE: ".concat(match.team.name));
        }
        else if ('teamA' in match && 'teamB' in match) {
            console.log("  ".concat(match.teamA.name, " vs ").concat(match.teamB.name));
        }
    });
});
