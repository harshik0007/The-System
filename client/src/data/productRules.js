export const ruleSections = [
  { id: 'tasks', title: 'Daily Task schedule', status: 'Established', body: 'Members follow a schedule of 7 Tasks per day. All 7 scheduled Tasks have equal weight in daily completion percentage. A Task is part of a repeating cycle of 1–7 days. In a 7-day cycle, Monday is Day 1 and the cycle runs through Sunday; a Member joining on Wednesday joins at Day 3. Shorter cycles repeat from their configured Day 1.' },
  { id: 'task-changes', title: 'Task changes and deadlines', status: 'Established', body: 'The daily deadline is midnight India Standard Time. Members can make up to 3 Task changes per calendar week, Monday through Sunday. Every edit, replacement or rescheduling counts as a change. Unfinished Tasks do not carry forward as ordinary Tasks.' },
  { id: 'accountability-actions', title: 'Accountability Actions', status: 'Established', body: 'Every Task must have its own Accountability Action selected by the Member. An Accountability Action is linked to that Task and is not replaced by a generic, unrelated consequence.' },
  { id: 'recovery-quests', title: 'Recovery Quests and the Recovery Window', status: 'Established', body: 'When a Task is missed, its associated Accountability Action activates as a Recovery Quest. Each Recovery Quest has a 3-day Recovery Window. An unfinished Recovery Quest carries forward during that window. If it remains incomplete when the window expires, it becomes a failed quest and deducts 1 Grace Charge.' },
  { id: 'grace-charges', title: 'Grace Charges', status: 'Established', body: 'A Member starts with 3 Grace Charges. If the System detects 3 failed quests in a day, it deducts another 1 Grace Charge. This additional deduction can occur on the same day as the 1-charge deduction for a Recovery Quest whose Recovery Window expires. Both triggers can therefore deduct 2 Grace Charges in one day. When all Grace Charges are exhausted, the result is a Progression Reset; the account is preserved.' },
  { id: 'xp', title: 'XP and completion bonuses', status: 'Established concept; numerical values unresolved', body: 'Completing a Task awards base XP. Additional XP depends on overall Task completion. Bonus XP is awarded at 25%, 50%, 75% and 100% completion milestones. Numerical XP values and formulas have not been specified and are not shown here.' },
  { id: 'levels', title: 'Levels', status: 'Exact thresholds unresolved', body: 'Level is the progression measure. Exact level thresholds and any other numerical progression formulas have not been specified in this update.' },
  { id: 'ranks', title: 'Seven Ranks and exclusive badges', status: 'Working names established; benefits unresolved', body: 'Every new Member starts at Rank 07 Origin and progresses through Rank 06 Ember, Rank 05 Surge, Rank 04 Vector, Rank 03 Apex and Rank 02 Zenith toward Rank 01 Continuum. Each Rank has a geometric emblem and exclusive collectible badge with a rank-specific serial prefix: OR, EM, SU, VE, AP, ZE and CO. Ranks provide rank-specific XP benefits and unique profile badges. Numerical benefits and qualification thresholds are not specified. If an account is deleted, Ranks 07–03 retain historical earned-member counts and serial positions without shifting other serials. Ranks 02–01 remove the deleted badge, reduce that Rank’s count by one and shift higher serials down by one within that Rank only.' },
  { id: 'discipline-points', title: 'Discipline Points', status: 'Established', body: 'Every three months of discipline awards 0.25 Discipline Points. Stored Discipline Points have a maximum balance of 10. The precise test for what qualifies as three months of discipline has not been defined in this update.' },
  { id: 'emergency-pause', title: 'Emergency Pause', status: 'Limits established', body: 'Emergency Pause can be activated a maximum of 2 times per calendar month, for up to 7 consecutive days per activation. Additional operational effects during a pause are not specified in this update.' },
  { id: 'monthly-analysis', title: 'Monthly Analysis', status: 'Established', body: 'Monthly Analysis lets Members compare any available months within their current progression run.' },
  { id: 'leaderboard', title: 'Leaderboard', status: 'Basis established', body: 'The Leaderboard is based on XP, missed Tasks and failed quests. Exact scoring and ordering formulas have not been specified.' },
  { id: 'progression-reset', title: 'Progression Reset', status: 'Established outcome', body: 'Exhausting all Grace Charges causes a Progression Reset. It resets progression while preserving the account. The exact scope of the progression data reset has not been specified in this update.' },
  { id: 'verification', title: 'Proof and verification', status: 'Established concept', body: 'Tasks require proof. Evidence may include photos, videos, documents, external platform activity, or system-based activity for in-app Tasks. AI may assist image and document review but does not award XP; backend validation makes the final verification decision. After final verification and successful deletion confirmation, original proof is deleted from THE SYSTEM storage and a receipt without the original is retained. Third-party providers may have separate processing and retention limits.' },
];

export const taskCycleTable = [
  ['7-day cycle', 'Monday is Day 1; Sunday is Day 7'],
  ['Member joins Wednesday', 'Joins at Day 3 of the 7-day cycle'],
  ['1–6-day cycle', 'Repeats from its configured Day 1'],
];

export const xpMilestoneTable = [
  ['25%', 'Completion milestone bonus'],
  ['50%', 'Completion milestone bonus'],
  ['75%', 'Completion milestone bonus'],
  ['100%', 'Completion milestone bonus'],
];

export const faqItems = [
  ['General', 'What is THE SYSTEM?', 'THE SYSTEM is a personal discipline and progression platform centered on a daily Task schedule, user-selected Accountability Actions, XP, Levels and Ranks.'],
  ['Tasks', 'How many Tasks are scheduled each day?', 'The schedule contains 7 Tasks per day. Each Task belongs to a repeating cycle of 1–7 days.'],
  ['Tasks', 'How does the 7-day cycle work?', 'Monday is Day 1 and Sunday is Day 7. A Member joining on Wednesday enters at Day 3. Shorter cycles repeat from their configured Day 1.'],
  ['Tasks', 'When are Tasks due?', 'The daily deadline is midnight India Standard Time.'],
  ['Tasks', 'Can I change my Tasks?', 'You can make up to 3 Task changes in a calendar week, Monday through Sunday. Edits, replacements and rescheduling each count as a change.'],
  ['Tasks', 'Do unfinished Tasks carry forward?', 'Unfinished Tasks do not carry forward as ordinary Tasks. A missed Task activates its own associated Accountability Action as a Recovery Quest.'],
  ['Recovery Quests', 'What is an Accountability Action?', 'It is a consequence chosen by the Member for a particular Task. Every Task must have its own; unrelated generic Recovery Quests are not generated.'],
  ['Recovery Quests', 'What happens when I miss a Task?', 'Its associated Accountability Action activates as a Recovery Quest with a 3-day Recovery Window. An unfinished Recovery Quest carries forward during that window.'],
  ['Recovery Quests', 'What happens when the Recovery Window expires?', 'If the Recovery Quest is still incomplete, it becomes a failed quest and deducts 1 Grace Charge.'],
  ['Grace Charges', 'How many Grace Charges do I start with?', 'A Member starts with 3 Grace Charges.'],
  ['Grace Charges', 'Can I lose 2 Grace Charges in one day?', 'Yes. An expired Recovery Quest deducts 1 Grace Charge, and detection of 3 failed quests in a day deducts another 1. Both triggers can happen on the same day.'],
  ['Grace Charges', 'What happens when all Grace Charges are used?', 'A Progression Reset occurs. Your account is preserved while progression resets.'],
  ['XP and Levels', 'How is XP earned?', 'Completing a Task awards base XP. Additional XP depends on overall Task completion, with bonuses at 25%, 50%, 75% and 100%. Numerical formulas and values are not specified.'],
  ['Ranks', 'What are the seven Ranks?', 'Progression begins at Rank 07 Origin, then continues through Rank 06 Ember, Rank 05 Surge, Rank 04 Vector, Rank 03 Apex and Rank 02 Zenith to Rank 01 Continuum. Each has rank-specific XP benefits and a unique profile badge; numerical benefits and qualification thresholds are not specified.'],
  ['Ranks', 'How are badge serials handled if an account is deleted?', 'Ranks 07–03 retain historical counts and serial positions. Ranks 02–01 remove the badge entry, reduce the count by one and shift higher serials down within that Rank only. These are documented rules; no deletion or renumbering logic is implemented in the frontend.'],
  ['Discipline Points', 'How do Discipline Points work?', 'Every three months of discipline awards 0.25 Discipline Points. The maximum stored balance is 10. The qualification test for a three-month period has not been defined.'],
  ['Emergency Pause', 'How often can I use Emergency Pause?', 'A maximum of 2 activations per calendar month, each lasting up to 7 consecutive days. Other pause effects are not specified in this update.'],
  ['Monthly Analysis', 'What months can I compare?', 'Any available months in your current progression run.'],
  ['Leaderboard', 'What determines the Leaderboard?', 'It is based on XP, missed Tasks and failed quests. The exact scoring formula has not been specified.'],
  ['Progression Reset', 'What does a Progression Reset do?', 'It resets progression while preserving your account. The exact scope of progression data reset has not been specified.'],
  ['Privacy and Accounts', 'What happens to submitted proof?', 'After final verification and successful deletion confirmation, original proof is deleted from THE SYSTEM storage and a verification receipt without the original is retained. Third-party processing and retention may be separate.'],
];
