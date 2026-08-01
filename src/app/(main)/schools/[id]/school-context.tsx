
'use client';
import { createContext, useContext, ReactNode } from 'react';

// Define the shape of the data for a single school
export type SchoolData = {
  id: string;
  name: string;
  schoolId: string;
  principal: string;
  address: string;
  contact: string;
  schoolHeadEmail?: string;
  teacherCount: number;
  learnerCount: number;
  description: string;
  level: string;
  logoUrl?: string;
  bestPractices?: { title: string; description: string; image: string }[];
  statistics?: {
    enrollment?: { [year: string]: number };
    attendanceRate?: number;
    performanceIndex?: number;
  };
};

// Define the shape of the context value
interface SchoolContextValue {
  school: SchoolData | null;
  isLoading: boolean;
}

// Create the context with an undefined initial value
const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);

// Define the provider component
export function SchoolProvider({ children, value }: { children: ReactNode; value: SchoolContextValue }) {
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

// Define the custom hook to use the context
export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
