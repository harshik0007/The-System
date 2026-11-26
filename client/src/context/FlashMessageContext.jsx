import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '../components/app/AppIcon.jsx';

const FlashMessageContext = createContext(null);

function FlashMessageHost({ messages, dismiss }) {
  return createPortal(
    <div className="system-flash-stack" role="region" aria-label="System messages" aria-live="off">
      {messages.map((message) => (
        <div
          className={`system-flash system-flash--${message.type}`}
          key={message.id}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live={message.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <span className="system-flash__icon" aria-hidden="true"><AppIcon name={message.type === 'success' ? 'check' : message.type === 'error' ? 'close' : 'activity'} /></span>
          <p>{message.text}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => dismiss(message.id)}><AppIcon name="close" /></button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function FlashMessageProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const sequence = useRef(0);
  const timers = useRef(new Map());
  const activeFingerprints = useRef(new Map());

  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    for (const [fingerprint, activeId] of activeFingerprints.current) {
      if (activeId === id) activeFingerprints.current.delete(fingerprint);
    }
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const notify = useCallback((text, type = 'info', { duration } = {}) => {
    const messageText = String(text || '').trim();
    if (!messageText) return;
    const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const fingerprint = `${normalizedType}:${messageText}`;
    if (activeFingerprints.current.has(fingerprint)) return;
    const id = ++sequence.current;
    const message = { id, text: messageText, type: normalizedType };
    activeFingerprints.current.set(fingerprint, id);
    setMessages((current) => [...current.slice(-3), message]);
    const lifetime = duration ?? (normalizedType === 'error' ? 7000 : 4200);
    if (lifetime > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), lifetime));
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    activeFingerprints.current.clear();
  }, []);

  const value = useMemo(() => ({ notify, notifySuccess: (text, options) => notify(text, 'success', options), notifyError: (text, options) => notify(text, 'error', options), notifyInfo: (text, options) => notify(text, 'info', options) }), [notify]);
  return <FlashMessageContext.Provider value={value}>{children}<FlashMessageHost messages={messages} dismiss={dismiss} /></FlashMessageContext.Provider>;
}

export function useFlashMessages() {
  const context = useContext(FlashMessageContext);
  if (!context) throw new Error('useFlashMessages must be used within FlashMessageProvider.');
  return context;
}
