import React from 'react';

/** Two rooms side by side: the league's Side A / Side B. */
const LeagueIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="League">
    <rect x="4" y="8" width="18" height="32" rx="3" />
    <rect x="26" y="8" width="18" height="32" rx="3" />
    <text x="13" y="30" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor" stroke="none">A</text>
    <text x="35" y="30" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor" stroke="none">B</text>
  </svg>
);

export default LeagueIcon;
