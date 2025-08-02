import React, { createContext, useContext } from 'react';

export interface Team {
  id: string;
  teamNumber: number;
  name: string;
  player1FirstName: string;
  player1LastName: string;
  player2FirstName: string;
  player2LastName: string;
  phoneNumber: string;
  // New snake_case fields for SB compatibility
  player1_first_name?: string;
  player1_last_name?: string;
  player2_first_name?: string;
  player2_last_name?: string;
  phone_Number?: string;
  city: string;
  registeredTournaments?: string[];
  bostonPotTournaments?: string[];
  /**
   * If true, team does NOT pay Boston Pot for that tournament. Keyed by tournamentId.
   */
  bostonPotOptOut?: { [tournamentId: string]: boolean };
  paymentStatus?: 'pending' | 'paid';
  player1PaymentStatus?: 'pending' | 'paid';
  player2PaymentStatus?: 'pending' | 'paid';
  player1TournamentPayments?: { [tournamentId: string]: boolean };
  player2TournamentPayments?: { [tournamentId: string]: boolean };
  tournamentPayments?: { [tournamentId: string]: boolean };
  totalOwed?: number;
}

export interface Tournament {
  id: string;
  name: string;
  cost: number;
  bostonPotCost: number;
  description?: string;
  status: 'active' | 'pending' | 'finished';
}

export interface Game {
  id: string;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  boston: 'none' | 'teamA' | 'teamB';
  winner: 'teamA' | 'teamB';
  submittedBy: string;
  confirmedBy?: string;
  confirmed: boolean;
  timestamp: Date;
  matchId?: string;
  round?: number;
  teamAScore?: number;
  teamBScore?: number;
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
  setSchedules: React.Dispatch<React.SetStateAction<TournamentSchedule[]>>;
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
  addTeam: (player1First: string, player1Last: string, player2First: string, player2Last: string, phoneNumber: string, city: string, selectedTournaments: string[], bostonPotTournaments: string[]) => string;
  updateTeam: (updatedTeam: Team) => void;
  addTournament: (name: string, cost: number, bostonPotCost: number, description?: string) => void;
  updateTournament: (id: string, name: string, cost: number, bostonPotCost: number, description?: string) => void;
  submitGame: (game: any) => void;
  confirmGame: (gameId: string, confirmedBy: string) => void;
  updatePaymentStatus: (teamId: string, status: 'pending' | 'paid') => void;
  updatePlayerPaymentStatus: (teamId: string, player: 'player1' | 'player2', status: 'pending' | 'paid') => void;
  updatePlayerTournamentPayment: (teamId: string, player: 'player1' | 'player2', tournamentId: string, paid: boolean) => void;
  updateTeamPayment: (teamId: string, tournamentId: string, paid: boolean) => void;
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
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const useAppContext = () => useContext(AppContext);