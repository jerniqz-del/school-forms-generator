
'use client';
import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';

// Define the shape of the context value
interface DisclaimerContextValue {
  isDisclaimerOpen: boolean;
  setIsDisclaimerOpen: Dispatch<SetStateAction<boolean>>;
  disclaimerAgreed: boolean;
  setDisclaimerAgreed: Dispatch<SetStateAction<boolean>>;
  openDisclaimer: () => void;
}

// Create the context with an undefined initial value
const DisclaimerContext = createContext<DisclaimerContextValue | undefined>(undefined);

// Define the provider component
export function DisclaimerProvider({ children }: { children: ReactNode }) {
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  useEffect(() => {
    try {
      const hasAgreed = sessionStorage.getItem('disclaimerAgreed');
      if (hasAgreed === 'true') {
        setDisclaimerAgreed(true);
      } else {
        // If not agreed, open the disclaimer automatically for first-time users
        setIsDisclaimerOpen(true);
      }
    } catch (error) {
      console.error("Could not access sessionStorage:", error);
      // If sessionStorage is blocked, default to showing the disclaimer
      setIsDisclaimerOpen(true);
    }
  }, []);

  const openDisclaimer = () => setIsDisclaimerOpen(true);

  const value = { 
    isDisclaimerOpen, 
    setIsDisclaimerOpen,
    disclaimerAgreed,
    setDisclaimerAgreed,
    openDisclaimer 
  };

  return <DisclaimerContext.Provider value={value}>{children}</DisclaimerContext.Provider>;
}

// Define the custom hook to use the context
export function useDisclaimer() {
  const context = useContext(DisclaimerContext);
  if (context === undefined) {
    throw new Error('useDisclaimer must be used within a DisclaimerProvider');
  }
  return context;
}
