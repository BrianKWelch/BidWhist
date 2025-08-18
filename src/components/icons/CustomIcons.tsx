import React from 'react';

export const CommandCenterIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'cc.png'} 
    alt="Command Center" 
    className="w-14 h-14 object-contain"
  />
);


export const ResultsIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'results.png'} 
    alt="Results" 
    className="w-10 h-10 object-contain"
  />
);

export const BracketIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'bracket.png'} 
    alt="Bracket" 
    className="w-10 h-10 object-contain"
  />
);

export const CityIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'city.png'} 
    alt="City" 
    className="w-10 h-10 object-contain"
  />
);

export const GoIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'go.png'} 
    alt="Go to Player Portal" 
    className="w-20 h-20 object-contain"
  />
);

export const RefreshIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'refresh.png'} 
    alt="Refresh" 
    className="w-12 h-12 object-contain"
  />
);

export const MessageIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'message.png'} 
    alt="Message" 
    className="w-10 h-10 object-contain"
  />
);

export const ScheduleIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'sched.png'} 
    alt="Schedule" 
    className="w-10 h-10 object-contain"
  />
);

export const DollarIcon: React.FC = () => (
  <img 
    src={import.meta.env.BASE_URL + 'dollar.png'} 
    alt="Finance" 
    className="w-10 h-10 object-contain"
  />
);
