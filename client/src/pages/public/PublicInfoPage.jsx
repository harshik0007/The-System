import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/public/PublicLayout.jsx';
import { ActionLink, ContentSection, DataTable, InfoGrid } from '../../components/public/ContentBlocks.jsx';
import FAQAccordion from '../../components/public/FAQAccordion.jsx';
import ContactForm from '../../components/public/ContactForm.jsx';
import RankCard from '../../components/ranks/RankCard.jsx';
import RankProgression from '../../components/ranks/RankProgression.jsx';
import { ranks } from '../../data/ranks.js';
import { ruleSections, taskCycleTable, xpMilestoneTable } from '../../data/productRules.js';

const featureItems = [
  ['Daily Task schedule', 'Schedule at least 7 original Tasks for each cycle day in a repeating cycle of 1–7 days.'],
  ['Task change limit', 'New Tasks are free and start on the next IST date. Up to 3 existing Tasks may be edited, rescheduled or deleted each Monday–Sunday week in IST.'],
  ['Accountability Actions', 'Choose a distinct Accountability Action for every Task.'],
  ['Recovery Quests', 'A missed Task activates its own associated Accountability Action as a Recovery Quest.'],
  ['Recovery Window', 'An unfinished Recovery Quest carries forward during its 3-day Recovery Window.'],
  ['Grace Points', 'Start with 3. Individual expiry and the 6th-active-quest threshold can deduct a point.'],
  ['Progression Reset', 'Exhausted Grace Points trigger a Progression Reset that preserves the account.'],
  ['Task XP calculation', 'A 300 XP daily base pool is divided across original scheduled Tasks, then Rank multiplier and daily Rank XP cap apply. Awards are not active yet.'],
  ['Seven Ranks', 'Seven named Ranks follow a fixed lowest-to-highest order, each with a unique badge and rank-specific XP benefit.'],
  ['Discipline Points', 'Qualifying scheduled-task streaks award Rank-based recurring rewards; the balance is capped at 4.00.'],
  ['Emergency Pause', 'Use up to 2 activations per calendar month, each lasting up to 7 consecutive days.'],
  ['Monthly Analysis', 'Compare any available months in your current progression run.'],
  ['Leaderboard', 'Competitive ordering is based on XP, missed Tasks and failed quests.'],
  ['Task completion', 'Submitting records the current Task as Completed immediately. Proof fields are optional.'],
  ['Proof verification', 'AI verification and reviewer approval are not active. Selected files are not uploaded.'],
].map(([title, body], i) => ({ title, body, label: String(i + 1).padStart(2, '0'), icon: ['◇', '↗', '⌑', '⌁'][i % 4] }));

const steps = [
  ['Understand the System', 'Review the Task schedule, Accountability Actions, Recovery Windows and Grace Point rules before you begin.'],
  ['Create an account', 'Account creation belongs to the separate authentication milestone; this guide does not activate an account.'],
  ['Choose your cycle', 'Set a repeating Task cycle from 1 to 7 days. A 7-day cycle follows Monday through Sunday; someone joining Wednesday enters Day 3.'],
  ['Schedule your Tasks', 'Prepare at least seven original Tasks for each cycle day. All original Tasks scheduled that day have equal weight in completion percentage.'],
  ['Choose Accountability Actions', 'Assign a user-selected Accountability Action to every Task.'],
  ['Review weekly changes', 'New Tasks are free. Editing, rescheduling or deleting an existing Task uses one of the three weekly changes per Task.'],
  ['Complete Tasks by the deadline', 'The daily deadline is midnight India Standard Time. Unfinished Tasks do not carry forward as ordinary Tasks.'],
  ['Complete Recovery Quests', 'A missed Task activates its own action with a 3-day Recovery Window. An unfinished quest carries forward during that window.'],
  ['Track XP', 'The approved daily base pool is 300 XP across original scheduled Tasks, followed by the Rank multiplier and daily Rank XP cap. XP awards are not active yet.'],
  ['Review progression', 'Track Levels, seven Ranks, Monthly Analysis and the Leaderboard. A Progression Reset preserves your account.'],
].map(([title, body], i) => ({ title, body, label: String(i + 1).padStart(2, '0'), icon: '↗' }));

const pages = {
  about: { title: 'About THE SYSTEM', description: 'Learn about THE SYSTEM, its philosophy and long-term progression.', eyebrow: 'A framework for deliberate progress', heading: 'Progress is built, not given.', intro: 'THE SYSTEM is designed to turn personal intentions into a daily Task schedule, user-selected accountability and visible long-term progression.' },
  how: { title: 'How It Works', description: 'Understand Tasks, Accountability Actions, Recovery Quests, XP and progression.', eyebrow: 'The lifecycle', heading: 'From intention to verified progress.', intro: 'A clear sequence connects a repeating Task schedule to personal accountability, recovery and progression.' },
  features: { title: 'Features', description: 'Explore THE SYSTEM terminology and current Task, recovery and progression rules.', eyebrow: 'Designed around follow-through', heading: 'Tools for a more intentional life.', intro: 'These capabilities follow the latest product rules. Some platform functionality remains planned and is not active through these information pages.' },
  ranks: { title: 'Seven Ranks', description: 'Explore seven original Ranks and their exclusive collectible badge designs.', eyebrow: 'Progression', heading: 'Seven Ranks. One continuing path.', intro: 'Begin at Rank 07 Origin and progress through Ember, Surge, Vector, Apex and Zenith toward Rank 01 Continuum. Each Rank has a distinct emblem and collectible badge, with configured recurring Discipline Point rewards and daily XP benefits. One-time Rank-entry XP remains pending configuration.' },
  rules: { title: 'System Rules', description: 'The authoritative current reference for Tasks, Recovery Quests, Grace Points, XP and progression.', eyebrow: 'Public rulebook', heading: 'Know the commitments.', intro: 'This page reflects the current product rules. It distinguishes confirmed concepts from mechanics that still need definition.' },
  faq: { title: 'Frequently Asked Questions', description: 'Search answers about Tasks, Recovery Quests, Grace Points, XP, Ranks and Progression Reset.', eyebrow: 'Help & clarity', heading: 'Frequently asked questions.', intro: 'Answers follow the current product rules. Unspecified formulas and processes are identified as unresolved.' },
  'getting-started': { title: 'Getting Started', description: 'A beginner walkthrough for Task cycles, Accountability Actions and progression.', eyebrow: 'Start with intention', heading: 'Make your first commitment count.', intro: 'Understand your schedule, weekly change limit and Recovery rules before beginning. This guide does not activate account or Task functionality.' },
  contact: { title: 'Contact Us', description: 'Choose a support inquiry topic and preview a message to THE SYSTEM.', eyebrow: 'Contact', heading: 'How can we help?', intro: 'Choose the closest inquiry type. This page currently provides a form preview only and does not deliver messages.' },
};

function HowContent() {
  const lifecycle = [
    ['01', 'Follow your Task schedule', 'Complete 7 Tasks a day in a repeating 1–7-day cycle. The deadline is midnight IST.'],
    ['02', 'Choose Accountability Actions', 'Every Task has its own user-selected Accountability Action.'],
    ['03', 'Make weekly changes carefully', 'New Tasks are free. Up to 3 existing Tasks may be edited, rescheduled or deleted each Monday–Sunday week in IST.'],
    ['04', 'Complete each Task', 'Unfinished Tasks do not carry forward as ordinary Tasks.'],
    ['05', 'Recover through its linked action', 'A missed Task activates its associated Recovery Quest, not an unrelated generic consequence.'],
    ['06', 'Use the Recovery Window', 'The quest has 3 days; it carries forward while that window remains open.'],
    ['07', 'Earn XP', 'A completed Task earns base XP, with bonuses at 25%, 50%, 75% and 100% completion.'],
    ['08', 'Review your progression', 'Follow Levels, seven Ranks, Monthly Analysis and the Leaderboard.'],
  ].map(([label, title, body]) => ({ label, title, body, icon: '↗' }));
  const details = [
    { title: 'Grace Points', body: 'Start with 3. Individual expiry or a 6th active quest can deduct one point; the sixth quest clears the active group.', href: '/rules#grace-points' },
    { title: 'Emergency Pause', body: 'Up to 2 activations per calendar month, each lasting up to 7 consecutive days. A protected date does not break or pause Discipline.', href: '/rules#emergency-pause' },
    { title: 'Discipline Points', body: 'Qualify with 5 completed original scheduled tasks per non-paused day. Rank-based cycle rewards use a 4.00 point cap.', href: '/rules#discipline-points' },
  ].map((item, i) => ({ ...item, label: `0${i + 1}`, icon: '◇', action: 'Read rule' }));
  return <><ContentSection id="lifecycle" title="A deliberate daily cycle"><InfoGrid items={lifecycle} columns={4} /></ContentSection><ContentSection title="The details that matter"><InfoGrid items={details} columns={3} /></ContentSection></>;
}

function RulesContent() {
  const [open, setOpen] = useState('tasks');
  return <><div className="rules-layout"><nav className="rules-index" aria-label="On this page"><p>On this page</p>{ruleSections.map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => setOpen(item.id)}>{item.title}</a>)}</nav><div className="rules-accordion">{ruleSections.map((item) => <section className="rule-accordion" id={item.id} key={item.id}><h2><button type="button" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? '' : item.id)}>{item.title}<span className="rule-status">{item.status}</span><b aria-hidden="true">{open === item.id ? '−' : '+'}</b></button></h2>{open === item.id && <div className="rule-body"><p>{item.body}</p>{item.id === 'tasks' && <DataTable headers={['Cycle', 'Rule']} rows={taskCycleTable} caption="Repeating Task cycles" />}{item.id === 'xp' && <DataTable headers={['Calculation', 'Rule']} rows={xpMilestoneTable} caption="Task XP calculation order" />}</div>}</section>)}</div></div><p className="public-source-note">These rules reflect the current application behavior. Legal and policy pages remain <Link to="/legal/terms">drafts pending review</Link>.</p></>;
}

function RanksContent() {
  return <>
    <ContentSection id="ranks-sequence" title="Discover the seven Ranks">
      <div className="rank-gallery" role="group" aria-label="Seven Ranks, ordered from lowest to highest">
        <div className="rank-gallery__row rank-gallery__row--four">
          {ranks.slice(0, 4).map((rank) => <RankCard rank={rank} key={rank.number} />)}
        </div>
        <div className="rank-gallery__row rank-gallery__row--three">
          {ranks.slice(4).map((rank) => <RankCard rank={rank} key={rank.number} />)}
        </div>
      </div>
    </ContentSection>
    <RankProgression />
  </>;
}

function GettingStartedContent() {
  return <><ContentSection title="Your first cycle"><InfoGrid items={steps} columns={2} /></ContentSection><ContentSection title="Before you begin"><div className="public-notice"><strong>Know the current limits.</strong><p>Schedule at least seven equally weighted Tasks per cycle day. The deadline is midnight IST. You can make up to 3 changes to existing Tasks per Monday–Sunday calendar week; new Tasks are free. Each Task needs its own Accountability Action. A missed Task activates a 3-day Recovery Quest. Grace Points start at 3; exhausting them triggers a Progression Reset that preserves your account.</p><ActionLink to="/rules" secondary>Read the complete rules</ActionLink></div></ContentSection></>;
}

function AboutContent() {
  const values = [
    { title: 'Choose what matters', body: 'Progress begins with goals chosen by the person doing the work.', icon: '◇' },
    { title: 'Commit to a schedule', body: 'A repeating daily Task cycle gives meaningful action a practical structure.', icon: '⌑' },
    { title: 'Own your recovery', body: 'Every Task has an Accountability Action chosen by the Member in advance.', icon: '⌁' },
  ];
  return <><ContentSection title="What is THE SYSTEM?" className="about-intro"><p>THE SYSTEM is a universal real-life discipline and progression platform in development. It is designed to help Members shape meaningful intentions into a repeatable Task schedule, personal accountability and long-term progression.</p><blockquote>“Progress is built, not given.”</blockquote></ContentSection><ContentSection title="Why it exists"><p>Ambition needs a structure that makes the next action clear. THE SYSTEM connects a Member’s Tasks, self-selected Accountability Actions, XP and progression—without prescribing what a meaningful life should look like.</p></ContentSection><ContentSection title="A philosophy built around action"><InfoGrid items={values} columns={3} /></ContentSection><ContentSection title="Progress with context"><p>Levels, seven named Ranks and the Leaderboard are designed to reflect progress over time. Rank-based recurring Discipline Point rewards and daily XP percentages are configured. Exact Level thresholds use demonstration values, while one-time Rank-entry XP remains unconfigured.</p><ActionLink to="/how-it-works">See how it works</ActionLink></ContentSection></>;
}

function FeaturesContent() {
  return <ContentSection id="capabilities" title="A connected set of capabilities"><p>These describe current product rules and planned capabilities. They are not a claim that all features are live.</p><InfoGrid items={featureItems} columns={4} /></ContentSection>;
}

function ContactContent() {
  return <div className="contact-layout"><ContentSection title="Choose an inquiry"><InfoGrid columns={1} items={[
    { title: 'General inquiry', body: 'Questions about THE SYSTEM and its direction.' }, { title: 'Technical issue', body: 'A problem experienced while using an implemented page.' }, { title: 'Recovery Quest dispute', body: 'A question about a Task’s Accountability Action or Recovery Window.' }, { title: 'Account or privacy request', body: 'Account access, Progression Reset or privacy-related inquiry.' }, { title: 'Grievance inquiry', body: 'See the grievance draft for current process limitations.', href: '/legal/grievance', action: 'Read draft' },
  ]} /></ContentSection><ContentSection title="Message preview"><ContactForm /></ContentSection></div>;
}

export default function PublicInfoPage({ page }) {
  const meta = pages[page];
  let content;
  if (page === 'about') content = <AboutContent />;
  else if (page === 'how') content = <HowContent />;
  else if (page === 'features') content = <FeaturesContent />;
  else if (page === 'ranks') content = <RanksContent />;
  else if (page === 'rules') content = <RulesContent />;
  else if (page === 'faq') content = <ContentSection title="Search the rulebook"><FAQAccordion /></ContentSection>;
  else if (page === 'getting-started') content = <GettingStartedContent />;
  else content = <ContactContent />;
  return <PublicLayout {...meta}>{content}</PublicLayout>;
}
