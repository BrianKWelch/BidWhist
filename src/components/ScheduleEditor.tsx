import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { GripVertical, X, Plus, Save, RotateCcw } from 'lucide-react';
import type { TournamentSchedule, ScheduleMatch, Team } from '@/contexts/AppContext';

interface ScheduleEditorProps {
  tournamentId: string;
  teams: Team[];
  numberOfRounds: number;
  onSave: (schedule: TournamentSchedule) => void;
  onCancel: () => void;
  existingSchedule?: TournamentSchedule | null;
}

interface TeamAssignment {
  id: string;
  name: string;
  city: string;
  isLocked?: boolean;
}

interface RoundData {
  leftSide: (TeamAssignment | null)[];
  rightSide: (TeamAssignment | null)[];
  tables: (number | null)[];
  bench: TeamAssignment[];
  tableBench: number[];
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  tournamentId,
  teams,
  numberOfRounds,
  onSave,
  onCancel,
  existingSchedule
}) => {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize or load existing schedule
  useEffect(() => {
    if (existingSchedule) {
      loadExistingSchedule(existingSchedule);
    } else {
      generateInitialSchedule();
    }
  }, [teams, numberOfRounds]);

  const loadExistingSchedule = (schedule: TournamentSchedule) => {
    const roundData: RoundData[] = [];
    
    for (let round = 1; round <= numberOfRounds; round++) {
      const roundMatches = schedule.matches.filter(m => m.round === round);
      const leftSide: TeamAssignment[] = [];
      const rightSide: TeamAssignment[] = [];
      const tables: number[] = [];

      roundMatches.forEach(match => {
        const leftTeam = teams.find(t => t.id === match.teamA);
        const rightTeam = teams.find(t => t.id === match.teamB);
        
        if (leftTeam) {
          leftSide.push({
            id: leftTeam.id,
            name: leftTeam.name,
            city: leftTeam.city
          });
        }
        
        if (rightTeam) {
          rightSide.push({
            id: rightTeam.id,
            name: rightTeam.name,
            city: rightTeam.city
          });
        }
        
        tables.push(match.table || 1);
      });

             roundData.push({ leftSide, rightSide, tables, bench: [], tableBench: [] });
    }

    setRounds(roundData);
  };

        const generateInitialSchedule = async () => {
     setIsGenerating(true);
     
     try {
       // Check if we have teams
       if (teams.length === 0) {
         throw new Error('No teams available to generate schedule');
       }

       // Use the original working scheduler logic
       const { generateNRoundsWithByeAndFinal } = await import('@/lib/scheduler');
       
       // Convert teams to scheduler format
       const schedulerTeams = teams.map(team => ({
         id: team.id,
         name: team.name,
         city: team.city
       }));

       // Generate rounds using the working logic
       const roundMatches = generateNRoundsWithByeAndFinal(schedulerTeams, numberOfRounds);
       
       // Convert back to our format
       const allRounds: RoundData[] = [];
       
       for (let roundIndex = 0; roundIndex < roundMatches.length; roundIndex++) {
         const roundData = roundMatches[roundIndex];
         const leftSide: TeamAssignment[] = [];
         const rightSide: TeamAssignment[] = [];
         const tables: number[] = [];
         
         roundData.forEach((match, matchIndex) => {
           if ('teamA' in match && 'teamB' in match) {
             // Determine if teams should be locked (same city teams)
             const isLocked = match.teamA.city === match.teamB.city && match.teamA.city !== 'BYE';
             
             // Ensure BYE always goes to left side, real team to right side
             const isByeA = match.teamA.id === 'BYE';
             const isByeB = match.teamB.id === 'BYE';
             
             if (isByeA) {
               // BYE is teamA, put it on left side
               leftSide.push({
                 id: match.teamA.id,
                 name: match.teamA.name,
                 city: match.teamA.city,
                 isLocked: isLocked
               });
               rightSide.push({
                 id: match.teamB.id,
                 name: match.teamB.name,
                 city: match.teamB.city,
                 isLocked: isLocked
               });
             } else if (isByeB) {
               // BYE is teamB, put it on left side, real team on right
               leftSide.push({
                 id: match.teamB.id,
                 name: match.teamB.name,
                 city: match.teamB.city,
                 isLocked: isLocked
               });
               rightSide.push({
                 id: match.teamA.id,
                 name: match.teamA.name,
                 city: match.teamA.city,
                 isLocked: isLocked
               });
             } else {
               // No BYE, normal assignment
               leftSide.push({
                 id: match.teamA.id,
                 name: match.teamA.name,
                 city: match.teamA.city,
                 isLocked: isLocked
               });
               rightSide.push({
                 id: match.teamB.id,
                 name: match.teamB.name,
                 city: match.teamB.city,
                 isLocked: isLocked
               });
             }
             
             tables.push(matchIndex + 1);
           }
         });
         
         allRounds.push({
           leftSide,
           rightSide,
           tables: [...tables].sort(() => Math.random() - 0.5), // Randomize table order
           bench: [],
           tableBench: []
         });
       }

       setRounds(allRounds);
       setAvailableTeams([]); // All teams are assigned
      
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast({ title: 'Error generating schedule', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const [sourceSide, roundIndex] = source.droppableId.split('-');
    const [destSide, destRoundIndex] = destination.droppableId.split('-');
    
    const roundIdx = parseInt(roundIndex);
    const newRounds = [...rounds];
    const round = newRounds[roundIdx];

    // Handle table number dragging
    if (sourceSide === 'table' || destSide === 'table' || sourceSide === 'tableBench' || destSide === 'tableBench') {
      if (sourceSide === 'table' && destSide === 'tableBench') {
        // Moving from table to bench - replace with null to maintain position
        const tableIndex = parseInt(source.droppableId.split('-')[2]);
        const tableValue = round.tables[tableIndex];
        if (tableValue !== null) {
          round.tables[tableIndex] = null;
          round.tableBench.push(tableValue);
        }
      } else if (sourceSide === 'tableBench' && destSide === 'table') {
        // Moving from bench to table - swap with whatever is at the destination
        const tableValue = round.tableBench[source.index];
        const tableIndex = parseInt(destination.droppableId.split('-')[2]);
        const existingValue = round.tables[tableIndex];
        
        // Remove from bench
        round.tableBench.splice(source.index, 1);
        
        // If there's an existing table at the destination, move it to bench
        if (existingValue !== null) {
          round.tableBench.push(existingValue);
        }
        
        // Place the bench table at the destination
        round.tables[tableIndex] = tableValue;
      } else if (sourceSide === 'table' && destSide === 'table') {
        // Reordering within tables - swap the values
        const sourceIndex = parseInt(source.droppableId.split('-')[2]);
        const destIndex = parseInt(destination.droppableId.split('-')[2]);
        const sourceValue = round.tables[sourceIndex];
        const destValue = round.tables[destIndex];
        round.tables[sourceIndex] = destValue;
        round.tables[destIndex] = sourceValue;
      } else if (sourceSide === 'tableBench' && destSide === 'tableBench') {
        // Reordering within bench
        const [removed] = round.tableBench.splice(source.index, 1);
        round.tableBench.splice(destination.index, 0, removed);
      }
      
      setRounds(newRounds);
      return;
    }

         // Handle team dragging
     if (sourceSide === 'left' && destSide === 'bench') {
       // Moving from left side to bench
       const teamIndex = parseInt(source.droppableId.split('-')[2]);
       const team = round.leftSide[teamIndex];
       if (team) {
         round.leftSide[teamIndex] = null;
         round.bench.push(team);
       }
     } else if (sourceSide === 'right' && destSide === 'bench') {
       // Moving from right side to bench
       const teamIndex = parseInt(source.droppableId.split('-')[2]);
       const team = round.rightSide[teamIndex];
       if (team) {
         round.rightSide[teamIndex] = null;
         round.bench.push(team);
       }
     } else if (sourceSide === 'bench' && destSide === 'left') {
       // Moving from bench to left side - swap with whatever is at the destination
       const team = round.bench[source.index];
       const teamIndex = parseInt(destination.droppableId.split('-')[2]);
       const existingTeam = round.leftSide[teamIndex];
       
       // Remove from bench
       round.bench.splice(source.index, 1);
       
       // If there's an existing team at the destination, move it to bench
       if (existingTeam) {
         round.bench.push(existingTeam);
       }
       
       // Place the bench team at the destination
       round.leftSide[teamIndex] = team;
     } else if (sourceSide === 'bench' && destSide === 'right') {
       // Moving from bench to right side - swap with whatever is at the destination
       const team = round.bench[source.index];
       const teamIndex = parseInt(destination.droppableId.split('-')[2]);
       const existingTeam = round.rightSide[teamIndex];
       
       // Remove from bench
       round.bench.splice(source.index, 1);
       
       // If there's an existing team at the destination, move it to bench
       if (existingTeam) {
         round.bench.push(existingTeam);
       }
       
       // Place the bench team at the destination
       round.rightSide[teamIndex] = team;
     } else if (sourceSide === 'left' && destSide === 'left') {
       // Reordering within left side - swap the values
       const sourceIndex = parseInt(source.droppableId.split('-')[2]);
       const destIndex = parseInt(destination.droppableId.split('-')[2]);
       const sourceTeam = round.leftSide[sourceIndex];
       const destTeam = round.leftSide[destIndex];
       round.leftSide[sourceIndex] = destTeam;
       round.leftSide[destIndex] = sourceTeam;
     } else if (sourceSide === 'right' && destSide === 'right') {
       // Reordering within right side - swap the values
       const sourceIndex = parseInt(source.droppableId.split('-')[2]);
       const destIndex = parseInt(destination.droppableId.split('-')[2]);
       const sourceTeam = round.rightSide[sourceIndex];
       const destTeam = round.rightSide[destIndex];
       round.rightSide[sourceIndex] = destTeam;
       round.rightSide[destIndex] = sourceTeam;
     } else if (sourceSide === 'left' && destSide === 'right') {
       // Moving from left side to right side - swap with whatever is at the destination
       const sourceIndex = parseInt(source.droppableId.split('-')[2]);
       const destIndex = parseInt(destination.droppableId.split('-')[2]);
       const sourceTeam = round.leftSide[sourceIndex];
       const destTeam = round.rightSide[destIndex];
       
       // Swap the teams (handle null values)
       round.leftSide[sourceIndex] = destTeam;
       round.rightSide[destIndex] = sourceTeam;
     } else if (sourceSide === 'right' && destSide === 'left') {
       // Moving from right side to left side - swap with whatever is at the destination
       const sourceIndex = parseInt(source.droppableId.split('-')[2]);
       const destIndex = parseInt(destination.droppableId.split('-')[2]);
       const sourceTeam = round.rightSide[sourceIndex];
       const destTeam = round.leftSide[destIndex];
       
       // Swap the teams (handle null values)
       round.rightSide[sourceIndex] = destTeam;
       round.leftSide[destIndex] = sourceTeam;
     } else if (sourceSide === 'bench' && destSide === 'bench') {
       // Reordering within bench
       const [removed] = round.bench.splice(source.index, 1);
       round.bench.splice(destination.index, 0, removed);
     }

    setRounds(newRounds);
    
    // Auto-generate subsequent rounds if Round 1 was modified
    if (roundIdx === 0) {
      setTimeout(() => autoGenerateSubsequentRounds(0), 0);
    }
  };

  const updateTableNumber = (roundIndex: number, matchIndex: number, newTable: number) => {
    const newRounds = [...rounds];
    newRounds[roundIndex].tables[matchIndex] = newTable;
    setRounds(newRounds);
  };

  const saveSchedule = () => {
    const matches: ScheduleMatch[] = [];
    let matchId = 1;

    rounds.forEach((round, roundIndex) => {
      const roundNum = roundIndex + 1;
      const maxMatches = Math.max(round.leftSide.length, round.rightSide.length);

      for (let i = 0; i < maxMatches; i++) {
        const leftTeam = round.leftSide[i];
        const rightTeam = round.rightSide[i];
        const table = round.tables[i] || i + 1;

        if (leftTeam && rightTeam) {
          matches.push({
            id: `${tournamentId}-r${roundNum}-m${matchId++}`,
            teamA: leftTeam.id === 'BYE' ? null : leftTeam.id,
            teamB: rightTeam.id === 'BYE' ? null : rightTeam.id,
            round: roundNum,
            table,
            tournamentId,
            isBye: leftTeam.id === 'BYE' || rightTeam.id === 'BYE',
            isSameCity: leftTeam.city === rightTeam.city && leftTeam.city !== 'BYE'
          });
        }
      }
    });

    const schedule: TournamentSchedule = {
      tournamentId,
      rounds: numberOfRounds,
      matches
    };

    onSave(schedule);
  };

       const regenerateRound = (roundIndex: number) => {
     try {
       if (roundIndex === 0) {
         generateInitialSchedule();
       } else {
         // Regenerate based on previous round rotation
         const newRounds = [...rounds];
         const prevRound = newRounds[roundIndex - 1];
         
         // Create new right side by rotating the previous right side
         const newRightSide = [...prevRound.rightSide];
         
                 // Rotate right side: move all teams up one position (last becomes first)
        if (newRightSide.length > 0) {
          const last = newRightSide.pop()!;
          newRightSide.unshift(last);
        }
         
         // Keep left side the same, rotate right side
         const tables = Array.from({ length: Math.max(prevRound.leftSide.length, prevRound.rightSide.length) }, (_, i) => i + 1);
         const newTables = [...tables].sort(() => Math.random() - 0.5);
         
         newRounds[roundIndex] = {
           leftSide: [...prevRound.leftSide],
           rightSide: newRightSide,
           tables: newTables,
           bench: [],
           tableBench: []
         };
         
         setRounds(newRounds);
       }
     } catch (error) {
       console.error('Error regenerating round:', error);
       toast({ title: 'Error regenerating round', variant: 'destructive' });
     }
   };

   // Auto-generate subsequent rounds when Round 1 changes
     const autoGenerateSubsequentRounds = (roundIndex: number) => {
    if (roundIndex === 0) {
      // When Round 1 changes, regenerate all subsequent rounds
      const newRounds = [...rounds];
      
      for (let i = 1; i < newRounds.length; i++) {
        const prevRound = newRounds[i - 1];
        const newRightSide = [...prevRound.rightSide];
        
        // Rotate right side: move all teams up one position (last becomes first)
        if (newRightSide.length > 0) {
          const last = newRightSide.pop()!;
          newRightSide.unshift(last);
        }
        
        // Keep left side the same, rotate right side
        const tables = Array.from({ length: Math.max(prevRound.leftSide.length, prevRound.rightSide.length) }, (_, i) => i + 1);
        const newTables = [...tables].sort(() => Math.random() - 0.5);
        
        newRounds[i] = {
          leftSide: [...prevRound.leftSide],
          rightSide: newRightSide,
          tables: newTables,
          bench: [],
          tableBench: []
        };
      }
      
      // Now regenerate the catch-up round with the correct logic
      const catchUpRoundIndex = newRounds.length - 1;
      if (catchUpRoundIndex > 0) {
        // Collect all teams that had BYE in the previous rounds
        const teamsWithBye: TeamAssignment[] = [];
        
        for (let roundIdx = 0; roundIdx < catchUpRoundIndex; roundIdx++) {
          const round = newRounds[roundIdx];
          for (let matchIdx = 0; matchIdx < round.leftSide.length; matchIdx++) {
            const leftTeam = round.leftSide[matchIdx];
            const rightTeam = round.rightSide[matchIdx];
            
            if (leftTeam && rightTeam) {
              if (leftTeam.id === 'BYE' && rightTeam.id !== 'BYE') {
                teamsWithBye.push(rightTeam);
              } else if (rightTeam.id === 'BYE' && leftTeam.id !== 'BYE') {
                teamsWithBye.push(leftTeam);
              }
            }
          }
        }
        
        // Create the catch-up round with only teams that had BYE
        const catchUpLeftSide: TeamAssignment[] = [];
        const catchUpRightSide: TeamAssignment[] = [];
        const catchUpTables: number[] = [];
        
        for (let i = 0; i < teamsWithBye.length; i += 2) {
          const teamA = teamsWithBye[i];
          const teamB = teamsWithBye[i + 1];
          
          if (teamA && teamB) {
            catchUpLeftSide.push(teamA);
            catchUpRightSide.push(teamB);
            catchUpTables.push(Math.floor(i / 2) + 1);
          }
        }
        
        newRounds[catchUpRoundIndex] = {
          leftSide: catchUpLeftSide,
          rightSide: catchUpRightSide,
          tables: catchUpTables,
          bench: [],
          tableBench: []
        };
      }
      
      setRounds(newRounds);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Schedule Editor - Option A</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={saveSchedule}>
                <Save className="w-4 h-4 mr-2" />
                Save Schedule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2">Generating schedule...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {rounds.map((round, roundIndex) => (
                <Card key={roundIndex}>
                  <CardHeader>
                                         <div className="flex justify-between items-center">
                       <CardTitle>Round {roundIndex + 1}</CardTitle>
                       <div className="flex gap-2">
                         {roundIndex === 0 && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => autoGenerateSubsequentRounds(0)}
                           >
                             <RotateCcw className="w-4 h-4 mr-2" />
                             Auto-Generate Rounds 2-{numberOfRounds}
                           </Button>
                         )}
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => regenerateRound(roundIndex)}
                         >
                           <RotateCcw className="w-4 h-4 mr-2" />
                           Regenerate
                         </Button>
                       </div>
                     </div>
                  </CardHeader>
                                     <CardContent>
                     <DragDropContext onDragEnd={handleDragEnd}>
                       <div className="space-y-4">
                                                   {/* Bench Area */}
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                            <Label className="text-sm font-medium mb-2 block">Bench - Drop teams and table numbers here to reorganize</Label>
                            
                            {/* Teams in Bench */}
                            <div className="mb-3">
                              <Label className="text-xs text-gray-600 mb-1 block">Teams:</Label>
                              <Droppable droppableId={`bench-${roundIndex}`}>
                                {(provided) => (
                                  <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="min-h-[40px] flex flex-wrap gap-2"
                                  >
                                    {round.bench.map((team, index) => (
                                      <Draggable
                                        key={team.id}
                                        draggableId={`bench-${roundIndex}-${team.id}`}
                                        index={index}
                                      >
                                        {(provided) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`flex items-center gap-2 px-3 py-2 border rounded text-sm bg-white shadow-sm ${
                                              team.isLocked ? 'bg-yellow-50 border-yellow-200' : 'bg-white'
                                            }`}
                                          >
                                            <div {...provided.dragHandleProps}>
                                              <GripVertical className="w-3 h-3 text-gray-400" />
                                            </div>
                                            <div className="text-center">
                                              <div className="font-medium">{team.name}</div>
                                              <div className="text-xs text-gray-500">{team.city}</div>
                                            </div>
                                            {team.isLocked && (
                                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                                Locked
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>

                            {/* Table Numbers in Bench */}
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Table Numbers:</Label>
                              <Droppable droppableId={`tableBench-${roundIndex}`}>
                                {(provided) => (
                                  <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="min-h-[40px] flex flex-wrap gap-2"
                                  >
                                    {round.tableBench.map((tableNum, index) => (
                                      <Draggable
                                        key={`tableBench-${tableNum}`}
                                        draggableId={`tableBench-${roundIndex}-${tableNum}`}
                                        index={index}
                                      >
                                        {(provided) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="flex items-center gap-2 px-3 py-2 border rounded text-sm bg-blue-50 border-blue-200 shadow-sm"
                                          >
                                            <div {...provided.dragHandleProps}>
                                              <GripVertical className="w-3 h-3 text-blue-400" />
                                            </div>
                                            <div className="font-medium text-blue-700">Table {tableNum}</div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          </div>

                                                   {/* Matchups */}
                                                     <div className="space-y-2">
                                                            {round.leftSide.map((leftTeam, index) => {
                                 const rightTeam = round.rightSide[index];
                                 const table = round.tables[index];
                                 
                                 // Skip rendering if both teams are null
                                 if (!leftTeam && !rightTeam) return null;
                               
                               return (
                                 <div key={index} className="flex items-center gap-4 py-2">
                                   {/* Left Team */}
                                   <div className="flex-1 flex justify-end">
                                     <Droppable droppableId={`left-${roundIndex}-${index}`}>
                                       {(provided) => (
                                         <div
                                           {...provided.droppableProps}
                                           ref={provided.innerRef}
                                           className="min-h-[50px] flex items-center"
                                         >
                                           {leftTeam ? (
                                             <Draggable
                                               key={leftTeam.id}
                                               draggableId={`left-${roundIndex}-${leftTeam.id}`}
                                               index={0}
                                             >
                                            {(provided) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-2 px-4 py-2 border rounded text-sm w-48 ${
                                                  leftTeam.isLocked ? 'bg-yellow-50 border-yellow-200' : 'bg-white'
                                                }`}
                                              >
                                                <div {...provided.dragHandleProps}>
                                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <div className="flex-1 text-right">
                                                  <div className="font-medium">{leftTeam.name}</div>
                                                  <div className="text-xs text-gray-500">{leftTeam.city}</div>
                                                </div>
                                                {leftTeam.isLocked && (
                                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                                    Locked
                                                  </Badge>
                                                )}
                                                                                             </div>
                                             )}
                                           </Draggable>
                                           ) : (
                                             <Draggable
                                               key={`left-empty-${index}`}
                                               draggableId={`left-${roundIndex}-${index}`}
                                               index={0}
                                             >
                                               {(provided) => (
                                                 <div
                                                   ref={provided.innerRef}
                                                   {...provided.draggableProps}
                                                   className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded text-sm bg-gray-50 text-gray-400 min-w-[192px] justify-center cursor-move"
                                                 >
                                                   <div {...provided.dragHandleProps}>
                                                     <GripVertical className="w-3 h-3 text-gray-400" />
                                                   </div>
                                                   <span>Empty</span>
                                                 </div>
                                               )}
                                             </Draggable>
                                           )}
                                           {provided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  </div>

                                                                     {/* Table Number */}
                                   <div className="flex items-center gap-2 min-w-[100px] justify-center">
                                     <Droppable droppableId={`table-${roundIndex}-${index}`}>
                                       {(provided) => (
                                         <div
                                           {...provided.droppableProps}
                                           ref={provided.innerRef}
                                           className="min-h-[50px] flex items-center justify-center"
                                         >
                                           {table ? (
                                             <Draggable
                                               key={`table-${index}`}
                                               draggableId={`table-${roundIndex}-${index}`}
                                               index={0}
                                             >
                                               {(provided) => (
                                                 <div
                                                   ref={provided.innerRef}
                                                   {...provided.draggableProps}
                                                   className="flex items-center gap-2 px-3 py-2 border rounded text-sm bg-blue-50 border-blue-200 cursor-move"
                                                 >
                                                   <div {...provided.dragHandleProps}>
                                                     <GripVertical className="w-3 h-3 text-blue-400" />
                                                   </div>
                                                   <Input
                                                     type="number"
                                                     value={table}
                                                     onChange={(e) => updateTableNumber(roundIndex, index, parseInt(e.target.value) || 1)}
                                                     className="w-12 h-8 text-center text-sm border-0 bg-transparent p-0"
                                                     min={1}
                                                     max={12}
                                                   />
                                                 </div>
                                               )}
                                             </Draggable>
                                           ) : (
                                             <Draggable
                                               key={`table-empty-${index}`}
                                               draggableId={`table-${roundIndex}-${index}`}
                                               index={0}
                                             >
                                               {(provided) => (
                                                 <div
                                                   ref={provided.innerRef}
                                                   {...provided.draggableProps}
                                                   className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded text-sm bg-gray-50 text-gray-400 min-w-[80px] justify-center cursor-move"
                                                 >
                                                   <div {...provided.dragHandleProps}>
                                                     <GripVertical className="w-3 h-3 text-gray-400" />
                                                   </div>
                                                   <span>Empty</span>
                                                 </div>
                                               )}
                                             </Draggable>
                                           )}
                                           {provided.placeholder}
                                         </div>
                                       )}
                                     </Droppable>
                                     <span className="text-sm text-gray-500 font-medium">vs</span>
                                   </div>

                                                                     {/* Right Team */}
                                   <div className="flex-1">
                                     <Droppable droppableId={`right-${roundIndex}-${index}`}>
                                       {(provided) => (
                                         <div
                                           {...provided.droppableProps}
                                           ref={provided.innerRef}
                                           className="min-h-[50px] flex items-center"
                                         >
                                           {rightTeam ? (
                                             <Draggable
                                               key={rightTeam.id}
                                               draggableId={`right-${roundIndex}-${rightTeam.id}`}
                                               index={0}
                                             >
                                            {(provided) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`flex items-center gap-2 px-4 py-2 border rounded text-sm w-48 ${
                                                  rightTeam.isLocked ? 'bg-yellow-50 border-yellow-200' : 'bg-white'
                                                }`}
                                              >
                                                <div {...provided.dragHandleProps}>
                                                  <GripVertical className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                  <div className="font-medium">{rightTeam.name}</div>
                                                  <div className="text-xs text-gray-500">{rightTeam.city}</div>
                                                </div>
                                                {rightTeam.isLocked && (
                                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                                    Locked
                                                  </Badge>
                                                                                                 )}
                                               </div>
                                             )}
                                           </Draggable>
                                           ) : (
                                             <Draggable
                                               key={`right-empty-${index}`}
                                               draggableId={`right-${roundIndex}-${index}`}
                                               index={0}
                                             >
                                               {(provided) => (
                                                 <div
                                                   ref={provided.innerRef}
                                                   {...provided.draggableProps}
                                                   className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded text-sm bg-gray-50 text-gray-400 min-w-[192px] justify-center cursor-move"
                                                 >
                                                   <div {...provided.dragHandleProps}>
                                                     <GripVertical className="w-3 h-3 text-gray-400" />
                                                   </div>
                                                   <span>Empty</span>
                                                 </div>
                                               )}
                                             </Draggable>
                                           )}
                                           {provided.placeholder}
                                         </div>
                                       )}
                                     </Droppable>
                                   </div>
                                 </div>
                               );
                             })}
                          </div>
                       </div>
                     </DragDropContext>
                   </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 