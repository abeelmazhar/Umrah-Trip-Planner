import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AssistantDrawerContext = createContext(null);

export function AssistantDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [tripRequest, setTripRequest] = useState(null);

  const openDrawer = useCallback((tripId) => {
    if (typeof tripId === 'string' && tripId) setTripRequest({ tripId, at: Date.now() });
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((value) => !value), []);

  const value = useMemo(
    () => ({ open, tripRequest, openDrawer, closeDrawer, toggleDrawer }),
    [open, tripRequest, openDrawer, closeDrawer, toggleDrawer]
  );

  return <AssistantDrawerContext.Provider value={value}>{children}</AssistantDrawerContext.Provider>;
}

export function useAssistantDrawer() {
  const ctx = useContext(AssistantDrawerContext);
  if (!ctx) throw new Error('useAssistantDrawer must be used inside AssistantDrawerProvider');
  return ctx;
}
