import React, { createContext, useContext } from 'react';

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  phone_number: string;
  created_at: string;
}

export interface PlayerTournament {
  id: string;
  player_id: string;
  tournament_id: string;
  paid: boolean;
  b_paid: boolean;
  entered_boston_pot: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  teamNumber?: number;
  name: string;
  player1_id: string;
  player2_id: string;
  created_at: string;
  player1?: Player; // For joined data
  player2?: Player; // For joined data
  player1FirstName?: string; // Legacy for backward compatibility
  player1LastName?: string; // Legacy for backward compatibility
  player2FirstName?: string; // Legacy for backward compatibility
  player2LastName?: string; // Legacy for backward compatibility
  phoneNumber?: string; // Legacy for backward compatibility
  city?: string; // Legacy for backward compatibility
  registeredTournaments?: string[];
  bostonPotTournaments?: string[];
  bostonPotOptOut?: { [tournamentId: string]: boolean };
  paymentStatus?: 'pending' | 'paid';
  player1PaymentStatus?: 'pending' | 'paid';
  player2PaymentStatus?: 'pending' | 'paid';
  player1TournamentPayments?: { [tournamentId: string]: boolean };
  player2TournamentPayments?: { [tournamentId: string]: boolean };
  tournamentPayments?: { [tournamentId: string]: boolean };
  totalOwed?: number;
  // New Boston Pot fields
  player1BostonPotPayments?: { [tournamentId: string]: boolean };
  player2BostonPotPayments?: { [tournamentId: string]: boolean };
  bostonPotPayments?: { [tournamentId: string]: boolean };
  bostonPotMismatches?: { [tournamentId: string]: boolean };
}

export interface Tournament {
  id: string;
  name: string;
  cost: number;
  bostonPotCost: number;
  description?: string;
  status: 'active' | 'pending' | 'finished';
  tracksHands?: boolean;
}

export interface Game {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  boston?: 'none' | 'teamA' | 'teamB'; // Made optional for backward compatibility
  boston_a?: number;
  boston_b?: number;
  winner: 'teamA' | 'teamB';
  submittedBy: string;
  confirmedBy?: string;
  confirmed: boolean;
  timestamp: Date;
  matchId?: string;
  round?: number;
  teamAScore?: number;
  teamBScore?: number;
  handsA?: number;
  handsB?: number;
  status?: 'pending_confirmation' | 'confirmed' | 'disputed';
  entered_by_team_id?: string;
}

export interface ScheduleMatch {
  id: string;
  teamA: string;
  teamB: string;
  round: number;
  tournamentId: string;
  isBye?: boolean;
  isByeRound?: boolean;
  isSameCity?: boolean;
  table?: number;
  opponentPlaceholder?: string | { type: string; table: number };
}

export interface TournamentSchedule {
  tournamentId: string;
  rounds: number;
  matches: ScheduleMatch[];
}

export interface ScoreText {
  id: string;
  matchId: string;
  round: number;
  teamA: string;
  teamB: string;
  phoneNumber: string;
  messageContent: string;
  sentAt: Date;
  status: 'sent' | 'filled' | 'confirmed';
  scoreA?: number;
  scoreB?: number;
  boston?: 'none' | 'teamA' | 'teamB';
  filledBy?: string;
  confirmedBy?: string;
}

export interface ScoreSubmission {
  id: string;
  matchId: string;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  boston: 'none' | 'teamA' | 'teamB';
  handsA: number;
  handsB: number;
  submittedBy: string;
  timestamp: Date;
  round: number;
}

export interface TournamentResult {
  teamId: string;
  teamNumber: number;
  teamName: string;
  rounds: { [round: number]: { points: number; wl: string; boston: number } };
  totalPoints: number;
  totalWins: number;
  totalBoston: number;
}

export interface BracketTeam {
  seed: number;
  teamId: string;
  teamName: string;
  teamNumber: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  table: number;
  team1?: BracketTeam;
  team2?: BracketTeam;
  winner?: BracketTeam;
  team1Score?: number;
  team2Score?: number;
}

export interface Bracket {
  id: string;
  tournamentId: string;
  size: number;
  teams: BracketTeam[];
  matches: BracketMatch[];
  createdAt: Date;
}

interface AppContextType {
  deleteTeam: (teamId: string) => void;
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  finishTournament: (tournamentId: string) => void;
  getActiveTournament: () => Tournament | null;
  setActiveTournament: (tournamentId: string) => Promise<void>;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  teams: Team[];
  games: Game[];
  setGames: React.Dispatch<React.SetStateAction<Game[]>>;
  tournaments: Tournament[];
  schedules: TournamentSchedule[];
  scoreTexts: ScoreText[];
  scoreSubmissions: ScoreSubmission[];
  setScoreSubmissions: React.Dispatch<React.SetStateAction<ScoreSubmission[]>>;
  tournamentResults: { [tournamentId: string]: TournamentResult[] };
  setTournamentResults: React.Dispatch<React.SetStateAction<{ [tournamentId: string]: TournamentResult[] }>>;
  brackets: { [tournamentId: string]: Bracket };
  cities: string[];
  currentUser: string;
  setCurrentUser: (user: string) => void;
  addTeam: (player1First: string, player1Last: string, player2First: string, player2Last: string, phoneNumber: string, city: string, selectedTournaments: string[], bostonPotTournaments: string[]) => Promise<string>;
  createTeamFromPlayers: (player1: Player, player2: Player, tournamentId: string) => Promise<string>;
  updateTeam: (updatedTeam: Team) => void;
  addTournament: (name: string, cost: number, bostonPotCost: number, description?: string) => void;
  updateTournament: (id: string, name: string, cost: number, bostonPotCost: number, description?: string) => void;
  submitGame: (game: any) => void;
  beginScoreEntry: (params: { matchId: string; teamId: string; teamA: string; teamB: string; round: number }) => Promise<{ ok: boolean; reason?: 'conflict' | 'error' }>;
  confirmGame: (gameId: string, confirmedBy: string) => void;
  updatePaymentStatus: (teamId: string, status: 'pending' | 'paid') => void;
  updatePlayerPaymentStatus: (teamId: string, player: 'player1' | 'player2', status: 'pending' | 'paid') => void;
  updatePlayerTournamentPayment: (teamId: string, player: 'player1' | 'player2', tournamentId: string, paid: boolean) => void;
  updateTeamPayment: (teamId: string, tournamentId: string, isPaid: boolean) => void;
  updateGameScore: (gameId: string, teamAScore: number, teamBScore: number) => void;
  saveSchedule: (schedule: TournamentSchedule) => void;
  addScoreText: (scoreText: ScoreText) => void;
  updateScoreText: (id: string, updates: Partial<ScoreText>) => void;
  getPendingGames: () => Game[];
  getTeamStats: (teamId: string) => { wins: number; losses: number; totalPoints: number; bostons: number };
  sendScoreSheetLinks: (tournamentId: string, baseUrl: string) => Promise<void>;
  submitScore: (submission: any) => Promise<void>;
  confirmScore: (gameId: string, confirm: boolean) => Promise<void>;
  updateTournamentResult: (tournamentId: string, teamId: string, round: number, field: 'points' | 'wl' | 'boston', value: any) => void;
  getTournamentResults: (tournamentId: string) => TournamentResult[];
  clearTournamentResults: (tournamentId: string) => void;
  clearGames: (tournamentId: string) => void;
  clearScoreSubmissions: (tournamentId: string) => void;
  resetAllTournamentData: (tournamentId?: string) => void;
  saveBracket: (bracket: Bracket) => void;
  getBracket: (tournamentId: string) => Bracket | null;
  updateBracket: (tournamentId: string, updates: Partial<Bracket>) => void;
  deleteBracket: (tournamentId: string) => void;
  addCity: (city: string) => void;
  removeCity: (city: string) => void;
  updateCities: (cities: string[]) => void;
  updatePlaceholders: () => Promise<void>;
  forceReplaceAllPlaceholders: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshGamesFromSupabase: () => Promise<void>;
  updatePlayerPayment: (playerId: string, tournamentId: string, isPaid: boolean, isBostonPot: boolean) => Promise<void>;
  getPlayerTournamentPayments: (playerId: string) => Promise<PlayerTournament[]>;
  getTeamPaymentStatus: (team: Team, tournamentId: string) => { tournamentPaid: boolean; bostonPotPaid: boolean; bostonPotMismatch: boolean };
  calculateTeamTotalOwed: (team: Team) => number;
  refreshTeams: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const useAppContext = () => useContext(AppContext);