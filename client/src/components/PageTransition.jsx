import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Routes, useLocation } from 'react-router-dom';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isAuthenticatedExperiencePath } from '../utils/routePaths.js';

const FORM_REVEALS = [
  '.auth-form > .auth-field',
  '.auth-form > .auth-password-strength',
  '.auth-form > .auth-form-options',
  '.auth-form > .auth-checkbox-row',
];

function revealAuthPage(timeline, page, isInitial) {
  const duration = isInitial
    ? { card: 0.34, field: 0.14, headline: 0.22, background: 0.56, recovery: 0.17, controlStagger: 0.018 }
    : { card: 0.22, field: 0.11, headline: 0.17, background: 0.30, recovery: 0.14, controlStagger: 0.013 };
  const at = isInitial
    ? { logo: 0.07, card: 0.19, heading: 0.30, support: 0.34, icon: 0.31, fields: 0.32, recovery: 0.34, links: 0.49 }
    : { logo: 0.02, card: 0.06, heading: 0.13, support: 0.17, icon: 0.12, fields: 0.13, recovery: 0.14, links: 0.28 };

  const background = page.querySelector('.auth-atmosphere');
  const shadows = page.querySelectorAll('.auth-atmosphere__shard');
  const lighting = page.querySelectorAll('.auth-atmosphere__glow');
  const logos = page.querySelectorAll('.auth-layout .brand-logo');
  const asideCopy = page.querySelector('.auth-aside__copy');
  const card = page.querySelector('.auth-card');
  const topline = page.querySelector('.auth-card__topline');
  const heading = page.querySelector('.auth-card h1');
  const support = page.querySelector('.auth-card__description');
  const controls = page.querySelectorAll(FORM_REVEALS.join(', '));
  const verificationMark = page.querySelector('.auth-lock-mark');
  const recoveryCards = page.querySelectorAll('.auth-recovery-options article');
  const secondary = page.querySelectorAll('.auth-switch');
  const buttons = page.querySelectorAll('.auth-form > .auth-primary-button');

  if (background) timeline.fromTo(background, { opacity: 0.72 }, { opacity: 1, duration: duration.background, ease: 'power1.out', clearProps: 'opacity' }, 0);
  if (shadows.length) timeline.from(shadows, { opacity: 0, duration: duration.background * 0.78, stagger: 0.025, ease: 'power2.out', clearProps: 'opacity' }, 0.025);
  if (lighting.length) timeline.from(lighting, { opacity: 0, duration: duration.background, stagger: 0.035, ease: 'power1.out', clearProps: 'opacity' }, 0.015);
  if (logos.length) timeline.fromTo(logos,
    { opacity: 0, y: 9, filter: 'drop-shadow(0 0 0 rgba(81, 198, 242, 0))' },
    { opacity: 1, y: 0, filter: 'drop-shadow(0 0 8px rgba(81, 198, 242, 0.16))', duration: 0.26, stagger: 0.025, ease: 'power2.out', clearProps: 'opacity,transform,filter' },
    at.logo,
  );
  if (asideCopy) timeline.from(asideCopy, { opacity: 0, y: 7, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform' }, at.logo + 0.1);
  if (card) timeline.from(card, { opacity: 0.2, y: 12, duration: duration.card, ease: 'power2.out', clearProps: 'opacity,transform' }, at.card);
  if (topline) timeline.from(topline, { opacity: 0, y: 5, duration: 0.18, ease: 'power2.out', clearProps: 'opacity,transform' }, at.card + 0.04);
  if (heading) timeline.from(heading, { opacity: 0, y: 8, duration: duration.headline, ease: 'power2.out', clearProps: 'opacity,transform' }, at.heading);
  if (support) timeline.from(support, { opacity: 0, y: 6, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' }, at.support);
  if (verificationMark) timeline.from(verificationMark, { opacity: 0, scale: 0.94, rotation: -3, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform' }, at.icon);
  if (controls.length) timeline.from(controls, { opacity: 0, y: 6, duration: duration.field, stagger: duration.controlStagger, ease: 'power2.out', clearProps: 'opacity,transform' }, at.fields);
  if (recoveryCards.length) timeline.fromTo(recoveryCards,
    { opacity: 0, y: 8, borderColor: 'rgba(139, 181, 225, 0.08)' },
    { opacity: 1, y: 0, borderColor: 'rgba(110, 198, 232, 0.28)', duration: duration.recovery, stagger: isInitial ? 0.045 : 0.04, ease: 'power2.out', clearProps: 'opacity,transform,borderColor' },
    at.recovery,
  );
  const controlsEnd = controls.length ? at.fields + duration.field + (controls.length - 1) * duration.controlStagger : at.fields;
  const recoveryEnd = recoveryCards.length ? at.recovery + duration.recovery + (recoveryCards.length - 1) * (isInitial ? 0.045 : 0.04) : at.fields;
  const buttonStart = Math.max(controlsEnd, recoveryEnd) + 0.018;
  if (buttons.length) timeline.from(buttons, { opacity: 0.4, y: 5, duration: isInitial ? 0.15 : 0.12, stagger: 0.025, ease: 'power2.out', clearProps: 'opacity,transform' }, buttonStart);
  if (secondary.length) timeline.from(secondary, { opacity: 0, y: 5, duration: 0.12, stagger: 0.025, ease: 'power2.out', clearProps: 'opacity,transform' }, at.links);
}

function revealPublicPage(timeline, page, isInitial) {
  const duration = isInitial ? 0.42 : 0.28;
  const atmosphere = page.querySelector('.public-atmosphere');
  const header = page.querySelector('.site-header');
  const breadcrumb = page.querySelector('.public-breadcrumb');
  const eyebrow = page.querySelector('.public-hero .public-eyebrow');
  const heading = page.querySelector('.public-hero h1');
  const intro = page.querySelector('.public-hero__intro');
  const content = page.querySelector('.public-content');
  if (atmosphere) timeline.fromTo(atmosphere, { opacity: 0.25, scale: 0.985 }, { opacity: 1, scale: 1, duration: duration + 0.16, ease: 'power1.out', clearProps: 'opacity,transform' }, 0);
  if (header) timeline.from(header, { autoAlpha: 0, y: -5, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, 0.02);
  if (breadcrumb) timeline.from(breadcrumb, { autoAlpha: 0, y: 5, duration: 0.18, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, 0.07);
  if (eyebrow) timeline.from(eyebrow, { autoAlpha: 0, y: 8, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, 0.11);
  if (heading) timeline.from(heading, { autoAlpha: 0, y: 13, duration: 0.31, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }, 0.16);
  if (intro) timeline.from(intro, { autoAlpha: 0, y: 8, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, 0.26);
  if (content) timeline.from(content, { autoAlpha: 0, y: 10, duration: isInitial ? 0.36 : 0.26, ease: 'power2.out', clearProps: 'opacity,visibility,transform' }, 0.31);
}

export default function PageTransition({ children }) {
  const location = useLocation();
  const { member } = useAuth();
  const isPersistentMemberRoute = Boolean(member && isAuthenticatedExperiencePath(location.pathname));
  const reducedMotion = useReducedMotion();
  const [activeLocation, setActiveLocation] = useState(location);
  const [outgoingLocation, setOutgoingLocation] = useState(null);
  const stageRef = useRef(null);
  const activeViewRef = useRef(null);
  const outgoingViewRef = useRef(null);
  const pendingFocusKeyRef = useRef(null);
  const initialEntranceRef = useRef(true);
  const animationRunRef = useRef(0);

  useLayoutEffect(() => {
    if (location.key === activeLocation.key) return;

    initialEntranceRef.current = false;
    if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    pendingFocusKeyRef.current = location.key;
    if (member && isAuthenticatedExperiencePath(location.pathname)) {
      // Keep the authenticated shell mounted across app and information routes.
      // Only the nested page changes; the sidebar, topbar and server providers stay put.
      setOutgoingLocation(null);
      setActiveLocation(location);
      return;
    }
    setOutgoingLocation(activeLocation);
    setActiveLocation(location);
  }, [location, activeLocation, member]);

  useLayoutEffect(() => {
    if (pendingFocusKeyRef.current !== activeLocation.key) return;

    const focusHeading = () => {
      const heading = stageRef.current?.querySelector('.page-transition__view--enter h1');
      if (!heading) return false;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      pendingFocusKeyRef.current = null;
      return true;
    };

    if (focusHeading()) return undefined;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    if (stageRef.current) observer.observe(stageRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeLocation.key]);

  useLayoutEffect(() => {
    const entering = activeViewRef.current;
    const exiting = outgoingViewRef.current;
    if (!entering) return undefined;

    const runId = ++animationRunRef.current;
    const outgoingKey = outgoingLocation?.key;
    const isCurrentRun = () => animationRunRef.current === runId;
    let observer;
    let context;
    const finishExit = () => {
      if (outgoingKey && isCurrentRun()) {
        setOutgoingLocation((current) => (current?.key === outgoingKey ? null : current));
      }
    };

    if (member && isAuthenticatedExperiencePath(activeLocation.pathname)) {
      const page = entering.querySelector('.app-page-container > *');
      if (!page || reducedMotion) {
        finishExit();
        return undefined;
      }
      context = gsap.context(() => {
        gsap.fromTo(page,
          { autoAlpha: 0.78, y: 7 },
          { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,visibility,transform', onComplete: finishExit },
        );
      }, stageRef);
      return () => {
        if (isCurrentRun()) animationRunRef.current += 1;
        context?.revert();
      };
    }

    const hasPageContent = () => Boolean(entering.querySelector('.site-shell, .auth-layout, .public-layout, .app-layout'));
    const runEntrance = () => {
      if (!isCurrentRun()) return;
      if (reducedMotion) {
        finishExit();
        return;
      }

      context = gsap.context(() => {
        if (exiting) gsap.to(exiting, { opacity: 0.84, y: -4, duration: 0.18, ease: 'power1.out' });

        const timeline = gsap.timeline({
          defaults: { ease: 'power2.out' },
          onComplete: finishExit,
        });
        const isInitial = initialEntranceRef.current;
        const authPage = entering.querySelector('.auth-layout');
        const publicPage = entering.querySelector('.public-layout');

        if (authPage) {
          revealAuthPage(timeline, entering, isInitial);
        } else if (publicPage) {
          revealPublicPage(timeline, entering, isInitial);
        } else {
          timeline.fromTo(entering,
            { opacity: 0.8, y: 9 },
            { opacity: 1, y: 0, duration: isInitial ? 0.42 : 0.34, clearProps: 'opacity,transform' },
            0,
          );
        }
      }, stageRef);
    };

    if (reducedMotion) {
      finishExit();
    } else if (hasPageContent()) {
      runEntrance();
    } else {
      observer = new MutationObserver(() => {
        if (!hasPageContent()) return;
        observer.disconnect();
        observer = undefined;
        runEntrance();
      });
      observer.observe(entering, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (isCurrentRun()) animationRunRef.current += 1;
      context?.revert();
    };
  }, [activeLocation.key, reducedMotion, member]);

  if (isPersistentMemberRoute) {
    return (
      <div className="page-transition__stage page-transition__stage--persistent" ref={stageRef}>
        <div className="page-transition__view page-transition__view--enter" ref={activeViewRef}>
          <Routes location={location}>{children}</Routes>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition__stage" ref={stageRef}>
      {outgoingLocation && (
        <div
          className="page-transition__view page-transition__view--exit"
          key={`exit-${outgoingLocation.key}`}
          ref={outgoingViewRef}
          aria-hidden="true"
        >
          <Routes location={outgoingLocation}>{children}</Routes>
        </div>
      )}
      <div
        className="page-transition__view page-transition__view--enter"
        key={`enter-${activeLocation.key}`}
        ref={activeViewRef}
      >
        <Routes location={activeLocation}>{children}</Routes>
      </div>
    </div>
  );
}
