import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTeamName(teamName: string): string {
  if (!teamName || teamName === 'BYE') return teamName;
  
  const parts = teamName.split('/');
  if (parts.length !== 2) return teamName;
  
  const [firstName, lastName] = parts;
  
  // Extract first name and first initial of last name
  const firstNamePart = firstName.trim();
  const lastNameInitial = lastName.trim().charAt(0);
  
  return `${firstNamePart}/${lastNameInitial}`;
}