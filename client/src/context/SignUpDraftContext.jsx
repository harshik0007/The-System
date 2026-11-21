import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const EMPTY_DRAFT = Object.freeze({ firstName: '', middleName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '', termsAccepted: false });
const SignUpDraftContext = createContext(null);

export function SignUpDraftProvider({ children }) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT }));
  const updateDraft = useCallback((updater) => {
    setDraft((current) => typeof updater === 'function' ? updater(current) : { ...current, ...updater });
  }, []);
  const clearDraft = useCallback(() => setDraft({ ...EMPTY_DRAFT }), []);
  const value = useMemo(() => ({ draft, updateDraft, clearDraft }), [draft, updateDraft, clearDraft]);
  return <SignUpDraftContext.Provider value={value}>{children}</SignUpDraftContext.Provider>;
}

export function useSignUpDraft() {
  const context = useContext(SignUpDraftContext);
  if (!context) throw new Error('useSignUpDraft must be used within SignUpDraftProvider.');
  return context;
}
