import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '../supabaseClient';
import { DollarSign, Percent, AlertCircle } from 'lucide-react';

const DEFAULT_PERCENTAGES = {
  clubShare: 30,
  firstPlace: 50,
  secondPlace: 25,
  thirdPlace: 15,
  fourthPlace: 10,
  sidePot: 10,
};

function loadPercentages(tournamentId: string) {
  try {
    const raw = localStorage.getItem(`financePercentages_${tournamentId}`);
    if (raw) return { ...DEFAULT_PERCENTAGES, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PERCENTAGES };
}

function savePercentages(tournamentId: string, pct: typeof DEFAULT_PERCENTAGES) {
  try {
    localStorage.setItem(`financePercentages_${tournamentId}`, JSON.stringify(pct));
  } catch {}
}

const FinanceManager: React.FC = () => {
  const { tournaments, teams, getActiveTournament } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState('');

  const [clubShare, setClubShare] = useState(DEFAULT_PERCENTAGES.clubShare);
  const [firstPlace, setFirstPlace] = useState(DEFAULT_PERCENTAGES.firstPlace);
  const [secondPlace, setSecondPlace] = useState(DEFAULT_PERCENTAGES.secondPlace);
  const [thirdPlace, setThirdPlace] = useState(DEFAULT_PERCENTAGES.thirdPlace);
  const [fourthPlace, setFourthPlace] = useState(DEFAULT_PERCENTAGES.fourthPlace);
  const [sidePot, setSidePot] = useState(DEFAULT_PERCENTAGES.sidePot);

  const [entryCollected, setEntryCollected] = useState(0);
  const [entryOwed, setEntryOwed] = useState(0);
  const [bostonPotCollected, setBostonPotCollected] = useState(0);
  const [bostonPotOwed, setBostonPotOwed] = useState(0);
  const [bostonWinners, setBostonWinners] = useState(1);

  // Prepaid adjustment fields
  const [prepaidCount, setPrepaidCount] = useState(0);
  const [totalPlayerCount, setTotalPlayerCount] = useState(0);
  const [discountPerPlayer, setDiscountPerPlayer] = useState(0);
  const [baseMode, setBaseMode] = useState<'collected' | 'prepay'>('collected');
  const [giveback, setGiveback] = useState(0);

  // Default to active tournament on mount
  useEffect(() => {
    const activeTournament = getActiveTournament();
    if (activeTournament && !selectedTournament) {
      setSelectedTournament(activeTournament.id);
    }
  }, [getActiveTournament, selectedTournament]);

  // Load persisted percentages when tournament changes
  useEffect(() => {
    if (!selectedTournament) return;
    const pct = loadPercentages(selectedTournament);
    setClubShare(pct.clubShare);
    setFirstPlace(pct.firstPlace);
    setSecondPlace(pct.secondPlace);
    setThirdPlace(pct.thirdPlace);
    setFourthPlace(pct.fourthPlace);
    setSidePot(pct.sidePot);
  }, [selectedTournament]);

  // Save percentages to localStorage whenever they change
  useEffect(() => {
    if (!selectedTournament) return;
    savePercentages(selectedTournament, { clubShare, firstPlace, secondPlace, thirdPlace, fourthPlace, sidePot });
  }, [selectedTournament, clubShare, firstPlace, secondPlace, thirdPlace, fourthPlace, sidePot]);

  // Recalculate collected/owed when tournament or teams change
  useEffect(() => {
    if (!selectedTournament) {
      setEntryCollected(0);
      setEntryOwed(0);
      setBostonPotCollected(0);
      setBostonPotOwed(0);
      return;
    }
    const tournament = tournaments.find(t => t.id === selectedTournament);
    if (!tournament) return;

    let totalEntryCollected = 0;
    let totalEntryOwed = 0;
    let totalBostonCollected = 0;
    let totalBostonOwed = 0;

    teams.forEach(team => {
      if (!team.registeredTournaments?.includes(selectedTournament)) return;

      const entryCostPerPlayer = tournament.cost / 2;
      const p1Paid = team.player1TournamentPayments?.[selectedTournament] || false;
      const p2Paid = team.player2TournamentPayments?.[selectedTournament] || false;

      if (p1Paid) totalEntryCollected += entryCostPerPlayer;
      else totalEntryOwed += entryCostPerPlayer;

      if (p2Paid) totalEntryCollected += entryCostPerPlayer;
      else totalEntryOwed += entryCostPerPlayer;

      if (team.bostonPotTournaments?.includes(selectedTournament)) {
        if (p1Paid && p2Paid) {
          totalBostonCollected += tournament.bostonPotCost || 0;
        } else {
          totalBostonOwed += tournament.bostonPotCost || 0;
        }
      }
    });

    setEntryCollected(totalEntryCollected);
    setEntryOwed(totalEntryOwed);
    setBostonPotCollected(totalBostonCollected);
    setBostonPotOwed(totalBostonOwed);
  }, [selectedTournament, tournaments, teams]);

  // Fetch prepaid and total player counts from player_tournament
  useEffect(() => {
    if (!selectedTournament) {
      setPrepaidCount(0);
      setTotalPlayerCount(0);
      return;
    }
    const fetchCounts = async () => {
      const [{ count: prepaid }, { count: total }] = await Promise.all([
        supabase
          .from('player_tournament')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', selectedTournament)
          .eq('prepaid', true),
        supabase
          .from('player_tournament')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', selectedTournament),
      ]);
      setPrepaidCount(prepaid ?? 0);
      setTotalPlayerCount(total ?? 0);
    };
    fetchCounts();
  }, [selectedTournament]);

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const isFiveWay = tournament?.paymentModel === 'five_way';

  // 4-way: prize pool uses entry fees only; boston pot is separate
  // 5-way: prize pool combines entry fees + boston pot
  const totalCollected = isFiveWay ? entryCollected + bostonPotCollected : entryCollected;
  const totalOwed = isFiveWay ? entryOwed + bostonPotOwed : entryOwed;
  const totalExpected = totalCollected + totalOwed;

  // Prepaid adjustment
  const nonPrepaidCount = totalPlayerCount - prepaidCount;
  const assumePrepayAmount = totalCollected - (discountPerPlayer * totalPlayerCount);
  const adjustedBase = baseMode === 'prepay' ? assumePrepayAmount : totalCollected;

  const clubAmount = (adjustedBase * clubShare) / 100;
  const prizePoolBeforeGiveback = adjustedBase - clubAmount;
  const prizePool = prizePoolBeforeGiveback - giveback;

  const prizeTotal = isFiveWay
    ? firstPlace + secondPlace + thirdPlace + fourthPlace + sidePot
    : firstPlace + secondPlace + thirdPlace + fourthPlace;
  const prizeIsValid = prizeTotal === 100;

  const firstPayout = (prizePool * firstPlace) / 100;
  const secondPayout = (prizePool * secondPlace) / 100;
  const thirdPayout = (prizePool * thirdPlace) / 100;
  const fourthPayout = (prizePool * fourthPlace) / 100;
  const sidePotPayout = (prizePool * sidePot) / 100;

  const bostonSplit = bostonWinners > 0 ? bostonPotCollected / bostonWinners : 0;

  const amountClass = prizeIsValid ? '' : 'opacity-50';

  return (
    <div className="space-y-6">
      {/* Tournament selector */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center gap-4 pt-4">
            <Label htmlFor="tournamentSelect">Select Tournament</Label>
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger id="tournamentSelect" className="w-64">
                <SelectValue placeholder="Choose a tournament" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tournament && (
              <span className={`text-sm font-medium px-2 py-1 rounded ${isFiveWay ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {isFiveWay ? '5-Way Split' : '4-Way Split'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Money summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tournament Finance Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`grid grid-cols-1 gap-4 ${isFiveWay ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            <div>
              <Label>Money Collected ($)</Label>
              <div className="p-2 bg-green-100 rounded border font-semibold text-green-700">
                ${totalCollected.toFixed(2)}
              </div>
            </div>
            <div>
              <Label>Money Owed ($)</Label>
              <div className="p-2 bg-red-100 rounded border font-semibold text-red-700">
                ${totalOwed.toFixed(2)}
              </div>
            </div>
            <div>
              <Label>Total Expected ($)</Label>
              <div className="p-2 bg-blue-100 rounded border font-semibold text-blue-700">
                ${totalExpected.toFixed(2)}
              </div>
            </div>
            {!isFiveWay && (
              <div>
                <Label>Boston Pot Collected ($)</Label>
                <div className="p-2 bg-yellow-100 rounded border font-semibold text-yellow-700">
                  ${bostonPotCollected.toFixed(2)}
                </div>
              </div>
            )}
          </div>
          {isFiveWay && (
            <p className="text-sm text-purple-700 bg-purple-50 rounded p-2">
              5-Way mode: entry fees (${entryCollected.toFixed(2)} collected) + side pot fees (${bostonPotCollected.toFixed(2)} collected) are combined into one prize pool.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prepaid Adjustment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Prepaid Adjustment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Player counts */}
          <div className="flex gap-6 text-sm">
            <div className="flex flex-col items-center px-4 py-2 bg-green-50 rounded border border-green-200">
              <span className="text-2xl font-bold text-green-700">{prepaidCount}</span>
              <span className="text-green-600 font-medium">Prepaid</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 bg-orange-50 rounded border border-orange-200">
              <span className="text-2xl font-bold text-orange-700">{nonPrepaidCount}</span>
              <span className="text-orange-600 font-medium">Walk-in</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 bg-gray-50 rounded border border-gray-200">
              <span className="text-2xl font-bold text-gray-700">{totalPlayerCount}</span>
              <span className="text-gray-600 font-medium">Total Players</span>
            </div>
          </div>

          {/* Discount input */}
          <div className="flex items-center gap-3">
            <Label htmlFor="discountPerPlayer" className="min-w-0 flex-1">
              Discount Per Player ($)
              <span className="block text-xs text-gray-500 font-normal">
                Assume Prepay = Collected − (discount × {totalPlayerCount} players)
              </span>
            </Label>
            <Input
              id="discountPerPlayer"
              type="number"
              min={0}
              value={discountPerPlayer}
              onChange={e => setDiscountPerPlayer(Number(e.target.value))}
              className="w-24"
            />
          </div>

          {/* Two amounts — pick one */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBaseMode('collected')}
              className={`p-3 rounded border-2 text-left transition-colors ${
                baseMode === 'collected'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-xs font-medium text-gray-500 mb-1">Collected Amount</div>
              <div className={`text-xl font-bold ${baseMode === 'collected' ? 'text-green-700' : 'text-gray-600'}`}>
                ${totalCollected.toFixed(2)}
              </div>
              {baseMode === 'collected' && (
                <div className="text-xs text-green-600 mt-1">✓ Using as base</div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setBaseMode('prepay')}
              className={`p-3 rounded border-2 text-left transition-colors ${
                baseMode === 'prepay'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-xs font-medium text-gray-500 mb-1">Assume Prepay Amount</div>
              <div className={`text-xl font-bold ${baseMode === 'prepay' ? 'text-blue-700' : 'text-gray-600'}`}>
                ${assumePrepayAmount.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ${totalCollected.toFixed(2)} − (${discountPerPlayer} × {totalPlayerCount})
              </div>
              {baseMode === 'prepay' && (
                <div className="text-xs text-blue-600 mt-1">✓ Using as base</div>
              )}
            </button>
          </div>

        </CardContent>
      </Card>

      {/* Payout distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Payout Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Club share */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="clubShare" className="min-w-0 flex-1">Club Share (%)</Label>
              <Input
                id="clubShare"
                type="number"
                value={clubShare}
                onChange={(e) => setClubShare(Number(e.target.value))}
                className="w-20"
              />
              <div className="font-semibold text-green-600 min-w-0">
                ${clubAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Giveback field */}
          <div className="flex items-center gap-2">
            <Label htmlFor="giveback" className="min-w-0 flex-1">
              Giveback / Entry Fee Returns ($)
              <span className="block text-xs text-gray-500 font-normal">Subtracted from prize pool before player % calculations</span>
            </Label>
            <Input
              id="giveback"
              type="number"
              min={0}
              value={giveback}
              onChange={e => setGiveback(Number(e.target.value))}
              className="w-24"
            />
          </div>

          {giveback > 0 && (
            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-sm text-amber-700">
              After club share (${clubAmount.toFixed(2)}) and giveback (${giveback.toFixed(2)}) removed from ${adjustedBase.toFixed(2)} base — prize pool is ${prizePool.toFixed(2)}
            </div>
          )}

          {/* Prize pool splits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Prize Pool: ${prizePool.toFixed(2)}</h3>
              <div className={`flex items-center gap-1 text-sm font-semibold ${prizeIsValid ? 'text-green-600' : 'text-red-600'}`}>
                {!prizeIsValid && <AlertCircle className="h-4 w-4" />}
                Prize %: {prizeTotal}% {prizeIsValid ? '✓' : '— must equal 100%'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="first" className="min-w-0 flex-1">1st Place (%)</Label>
                <Input
                  id="first"
                  type="number"
                  value={firstPlace}
                  onChange={(e) => setFirstPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className={`font-semibold text-yellow-600 min-w-0 ${amountClass}`}>
                  ${firstPayout.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="second" className="min-w-0 flex-1">2nd Place (%)</Label>
                <Input
                  id="second"
                  type="number"
                  value={secondPlace}
                  onChange={(e) => setSecondPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className={`font-semibold text-gray-600 min-w-0 ${amountClass}`}>
                  ${secondPayout.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="third" className="min-w-0 flex-1">3rd Place (%)</Label>
                <Input
                  id="third"
                  type="number"
                  value={thirdPlace}
                  onChange={(e) => setThirdPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className={`font-semibold text-orange-600 min-w-0 ${amountClass}`}>
                  ${thirdPayout.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="fourth" className="min-w-0 flex-1">4th Place (%)</Label>
                <Input
                  id="fourth"
                  type="number"
                  value={fourthPlace}
                  onChange={(e) => setFourthPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className={`font-semibold text-blue-600 min-w-0 ${amountClass}`}>
                  ${fourthPayout.toFixed(2)}
                </div>
              </div>

              {isFiveWay && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="sidePot" className="min-w-0 flex-1">Side Pot (%)</Label>
                  <Input
                    id="sidePot"
                    type="number"
                    value={sidePot}
                    onChange={(e) => setSidePot(Number(e.target.value))}
                    className="w-20"
                  />
                  <div className={`font-semibold text-purple-600 min-w-0 ${amountClass}`}>
                    ${sidePotPayout.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Boston pot (4-way only) */}
            {!isFiveWay && (
              <div className="flex items-center gap-4 font-semibold mt-4">
                <div>
                  Boston Pot Split per Team: <span className="text-green-700">${bostonSplit.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="bostonWinners">Number of Boston Winners</Label>
                  <Input
                    id="bostonWinners"
                    type="number"
                    min={1}
                    value={bostonWinners}
                    onChange={e => setBostonWinners(Number(e.target.value))}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceManager;
