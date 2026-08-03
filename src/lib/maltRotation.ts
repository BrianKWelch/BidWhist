// MALT rotation formula derived from TableRotation.xlsx (Sheet2).
// Verified against all table counts 4–40 in the spreadsheet.
// For numTables N and current table T:
//   loser  → ceil(T / 2)
//   winner → N/2 + ceil(T/2)          (even N)
//   winner → (N+1)/2 + ceil((T-1)/2)  (odd N)

export function getMaltNext(
  numTables: number,
  tableNum: number
): { winner: number; loser: number } {
  const loser = Math.ceil(tableNum / 2);
  let winner: number;
  if (numTables % 2 === 0) {
    winner = numTables / 2 + Math.ceil(tableNum / 2);
  } else {
    winner = (numTables + 1) / 2 + Math.ceil((tableNum - 1) / 2);
  }
  return { winner, loser };
}

export function getMaltRotationTable(
  numTables: number
): Array<{ table: number; winner: number; loser: number }> {
  return Array.from({ length: numTables }, (_, i) => {
    const t = i + 1;
    return { table: t, ...getMaltNext(numTables, t) };
  });
}
