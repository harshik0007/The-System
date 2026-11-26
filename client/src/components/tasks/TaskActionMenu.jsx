import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '../app/AppIcon.jsx';
import '../../styles/task-action-menu.css';

const ACTIONS = [
  { mode: 'details', label: 'View Forfeit', icon: 'shield' },
  { mode: 'proof', label: 'Submit Proof', icon: 'tasks' },
  { mode: 'edit', label: 'Edit Task', icon: 'tasks', requiresAllowance: true },
  { mode: 'reschedule', label: 'Reschedule Task', icon: 'clock', requiresAllowance: true },
  { mode: 'delete', label: 'Delete Task', icon: 'close', destructive: true, requiresAllowance: true },
];

export default function TaskActionMenu({ task, onSelect, canModify = true, allowanceNote = 'No weekly changes remain. The allowance resets Monday in IST.' }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const frameRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'down', ready: false });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const positionMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const edge = 12;
      const menuHeight = menu.scrollHeight;
      const menuWidth = menu.getBoundingClientRect().width;
      const below = Math.max(0, window.innerHeight - rect.bottom - gap - edge);
      const above = Math.max(0, rect.top - gap - edge);
      const placement = menuHeight <= below || below >= above ? 'down' : 'up';
      const left = Math.min(Math.max(edge, rect.right - menuWidth), window.innerWidth - menuWidth - edge);
      const top = placement === 'up'
        ? Math.max(edge, rect.top - gap - menuHeight)
        : Math.max(edge, Math.min(window.innerHeight - menuHeight - edge, rect.bottom + gap));
      setPosition({ top, left, placement, ready: true });
    };

    positionMenu();
    const onViewportChange = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(positionMenu);
    };
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      cancelAnimationFrame(frameRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const buttons = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    const firstEnabled = buttons().find((button) => !button.disabled);
    firstEnabled?.focus();

    const onPointerDown = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const items = buttons().filter((button) => !button.disabled);
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        items[(currentIndex + direction + items.length) % items.length].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1].focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (mode) => {
    setOpen(false);
    onSelect?.(task, mode);
  };

  return (
    <div className={`task-card__manage${open ? ' is-open' : ''}`}>
      <button
        className="task-card__manage-trigger"
        type="button"
        ref={triggerRef}
        aria-label={`Task actions for ${task.name || task.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      ><span aria-hidden="true">···</span></button>
      {open && createPortal(
        <div
          className="task-card__manage-menu"
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${task.name || task.title}`}
          data-placement={position.placement}
          style={{ position: 'fixed', top: position.top, left: position.left, visibility: position.ready ? 'visible' : 'hidden' }}
        >
          {ACTIONS.map((action) => <button
            type="button"
            role="menuitem"
            className={action.destructive ? 'is-destructive' : undefined}
            disabled={action.requiresAllowance && !canModify}
            key={action.mode}
            onClick={() => select(action.mode)}
          ><AppIcon name={action.icon} /><span>{action.label}<i aria-hidden="true">›</i></span></button>)}
          {!canModify && <small>{allowanceNote}</small>}
        </div>,
        document.body,
      )}
    </div>
  );
}
