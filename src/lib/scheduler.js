"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
export function generateNRoundsWithByeAndFinal(inputTeams, numRounds) {
    // 1. Group teams by city
    var cityMap = {};
    for (var _i = 0, inputTeams_1 = inputTeams; _i < inputTeams_1.length; _i++) {
        var team = inputTeams_1[_i];
        if (!cityMap[team.city])
            cityMap[team.city] = [];
        cityMap[team.city].push(team);
    }
    var cities = Object.keys(cityMap);
    // 2. Find the best split city (minimizes column difference)
    var bestSplit = null;
    var _loop_1 = function (splitCity) {
        var otherCities = cities.filter(function (c) { return c !== splitCity; });
        // Try all possible assignments of other cities to left/right
        var assignments = [[]];
        for (var _f = 0, otherCities_1 = otherCities; _f < otherCities_1.length; _f++) {
            var city = otherCities_1[_f];
            var newAssignments = [];
            for (var _g = 0, assignments_1 = assignments; _g < assignments_1.length; _g++) {
                var assign = assignments_1[_g];
                newAssignments.push(__spreadArray(__spreadArray([], assign, true), [city], false));
                newAssignments.push(assign);
            }
            assignments.push.apply(assignments, newAssignments);
        }
        var _loop_2 = function (assign) {
            var leftCities = assign;
            var rightCities = otherCities.filter(function (c) { return !leftCities.includes(c); });
            var leftCount = leftCities.reduce(function (sum, c) { return sum + cityMap[c].length; }, 0);
            var rightCount = rightCities.reduce(function (sum, c) { return sum + cityMap[c].length; }, 0);
            var splitCount = cityMap[splitCity].length;
            // Try all possible splits of splitCity
            for (var leftSplit = 0; leftSplit <= splitCount; leftSplit++) {
                var rightSplit = splitCount - leftSplit;
                var totalLeft = leftCount + leftSplit;
                var totalRight = rightCount + rightSplit;
                var diff = Math.abs(totalLeft - totalRight);
                if (!bestSplit || diff < bestSplit.diff) {
                    bestSplit = {
                        splitCity: splitCity,
                        left: __spreadArray(__spreadArray([], leftCities, true), Array(leftSplit).fill(splitCity), true),
                        right: __spreadArray(__spreadArray([], rightCities, true), Array(rightSplit).fill(splitCity), true),
                        diff: diff,
                    };
                }
            }
        };
        for (var _h = 0, assignments_2 = assignments; _h < assignments_2.length; _h++) {
            var assign = assignments_2[_h];
            _loop_2(assign);
        }
    };
    for (var _a = 0, cities_1 = cities; _a < cities_1.length; _a++) {
        var splitCity = cities_1[_a];
        _loop_1(splitCity);
    }
    if (!bestSplit)
        throw new Error('Could not find a valid split');
    // 3. Build columns
    var leftTeams = [];
    var rightTeams = [];
    var splitCityTeams = __spreadArray([], cityMap[bestSplit.splitCity], true);
    // Assign split city teams to left (bottom) and right (top)
    var leftSplitCount = bestSplit.left.filter(function (c) { return c === bestSplit.splitCity; }).length;
    var rightSplitCount = bestSplit.right.filter(function (c) { return c === bestSplit.splitCity; }).length;
    leftTeams.push.apply(leftTeams, bestSplit.left.filter(function (c) { return c !== bestSplit.splitCity; }).flatMap(function (c) { return cityMap[c]; }));
    rightTeams.push.apply(rightTeams, bestSplit.right.filter(function (c) { return c !== bestSplit.splitCity; }).flatMap(function (c) { return cityMap[c]; }));
    leftTeams.push.apply(leftTeams, splitCityTeams.slice(0, leftSplitCount)); // bottom of left
    rightTeams.unshift.apply(// bottom of left
    rightTeams, splitCityTeams.slice(leftSplitCount)); // top of right
    // 4. Add BYE if needed
    var totalTeams = leftTeams.length + rightTeams.length;
    if (totalTeams % 2 !== 0) {
        var byeTeam = { id: 'BYE', name: 'BYE', city: 'BYE' };
        if (leftTeams.length < rightTeams.length)
            leftTeams.push(byeTeam);
        else
            rightTeams.push(byeTeam);
        totalTeams++;
    }
    // 5. Shuffle within columns (except split city teams, which are locked at top/bottom)
    // (Optional: implement a shuffle that avoids BYE vs. same city in first rounds)
    // 6. Generate rounds
    var rounds = [];
    for (var round = 0; round < Math.min(numRounds, leftTeams.length); round++) {
        var matches = [];
        for (var i = 0; i < leftTeams.length; i++) {
            matches.push({
                round: round + 1,
                teamA: leftTeams[i],
                teamB: rightTeams[i],
            });
        }
        rounds.push(matches);
        // Rotate right column down by 1
        rightTeams.unshift(rightTeams.pop());
    }
    // --- PATCH START: Add a bye round at the end for teams that had a bye ---
    // Collect all teams that had a bye in the main rounds
    var byeTeams = [];
    for (var _b = 0, rounds_1 = rounds; _b < rounds_1.length; _b++) {
        var round = rounds_1[_b];
        for (var _c = 0, round_1 = round; _c < round_1.length; _c++) {
            var match = round_1[_c];
            if ('isBye' in match && match.isBye && match.team.id !== 'BYE') {
                byeTeams.push(match.team);
            }
        }
    }
    // Remove duplicates
    var uniqueByeTeams = Array.from(new Set(byeTeams.map(function (t) { return t.id; })))
        .map(function (id) { return byeTeams.find(function (t) { return t.id === id; }); });
    if (uniqueByeTeams.length >= 2) {
        // Gather all previous matches for rematch prevention
        var previousMatches = [];
        for (var _d = 0, rounds_2 = rounds; _d < rounds_2.length; _d++) {
            var round = rounds_2[_d];
            for (var _e = 0, round_2 = round; _e < round_2.length; _e++) {
                var match = round_2[_e];
                if ('teamA' in match && 'teamB' in match) {
                    previousMatches.push({ teamAId: match.teamA.id, teamBId: match.teamB.id });
                }
            }
        }
        // Generate the bye round
        var byeRound = generateByeRound(uniqueByeTeams, previousMatches, rounds.length + 1);
        if (byeRound.length > 0) {
            rounds.push(byeRound);
        }
    }
    // --- PATCH END ---
    return rounds;
}
function generateOneRound(teams, previousMatches, round, byeTeams) {
    var matches = [];
    var matchedIds = new Set();
    var isOdd = teams.length % 2 === 1;
    // Count city frequencies
    var cityCounts = {};
    teams.forEach(function (t) { cityCounts[t.city] = (cityCounts[t.city] || 0) + 1; });
    var moreThanHalfSameCity = Object.values(cityCounts).some(function (count) { return count > teams.length / 2; });
    // Build rematch set
    var playedSet = new Set(previousMatches.map(function (m) { return "".concat([m.teamAId, m.teamBId].sort().join('-')); }));
    var shuffled = __spreadArray([], teams, true).sort(function () { return Math.random() - 0.5; });
    // Handle bye for odd number of teams
    if (isOdd) {
        // Find a team that hasn't had a bye yet
        var availableForBye = shuffled.filter(function (team) {
            return !byeTeams.some(function (byeTeam) { return byeTeam.id === team.id; });
        });
        if (availableForBye.length > 0) {
            var byeTeam = availableForBye[0];
            matches.push({ team: byeTeam, round: round, isBye: true });
            matchedIds.add(byeTeam.id);
        }
    }
    // Generate regular matches with rule priorities
    for (var i = 0; i < shuffled.length; i++) {
        var teamA = shuffled[i];
        if (matchedIds.has(teamA.id))
            continue;
        // 1. Try to find a team not from same city and not a rematch
        var found = false;
        for (var j = i + 1; j < shuffled.length; j++) {
            var teamB = shuffled[j];
            if (matchedIds.has(teamB.id))
                continue;
            var key = [teamA.id, teamB.id].sort().join('-');
            if (teamA.city === teamB.city && !moreThanHalfSameCity)
                continue;
            if (playedSet.has(key))
                continue;
            matches.push({ teamA: teamA, teamB: teamB, round: round });
            matchedIds.add(teamA.id);
            matchedIds.add(teamB.id);
            found = true;
            break;
        }
        if (found)
            continue;
        // 2. If not possible, allow same-city match (but not a rematch)
        for (var j = i + 1; j < shuffled.length; j++) {
            var teamB = shuffled[j];
            if (matchedIds.has(teamB.id))
                continue;
            var key = [teamA.id, teamB.id].sort().join('-');
            if (playedSet.has(key))
                continue;
            matches.push({ teamA: teamA, teamB: teamB, round: round });
            matchedIds.add(teamA.id);
            matchedIds.add(teamB.id);
            found = true;
            break;
        }
        if (found)
            continue;
        // 3. If not possible, allow a rematch (city doesn't matter)
        for (var j = i + 1; j < shuffled.length; j++) {
            var teamB = shuffled[j];
            if (matchedIds.has(teamB.id))
                continue;
            var key = [teamA.id, teamB.id].sort().join('-');
            matches.push({ teamA: teamA, teamB: teamB, round: round });
            matchedIds.add(teamA.id);
            matchedIds.add(teamB.id);
            break;
        }
    }
    return matches;
}
function generateByeRound(byeTeams, previousMatches, roundNum) {
    var matches = [];
    var matchedIds = new Set();
    var disallowed = new Set(previousMatches.map(function (m) { return "".concat([m.teamAId, m.teamBId].sort().join('-')); }));
    var shuffled = __spreadArray([], byeTeams, true).sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < shuffled.length; i++) {
        var teamA = shuffled[i];
        if (matchedIds.has(teamA.id))
            continue;
        for (var j = i + 1; j < shuffled.length; j++) {
            var teamB = shuffled[j];
            if (matchedIds.has(teamB.id))
                continue;
            if (teamA.city === teamB.city)
                continue;
            var key = [teamA.id, teamB.id].sort().join('-');
            if (disallowed.has(key))
                continue;
            matches.push({ teamA: teamA, teamB: teamB, round: roundNum });
            matchedIds.add(teamA.id);
            matchedIds.add(teamB.id);
            break;
        }
    }
    return matches;
}
