# THE SYSTEM — Product Rules

This document is the current product-rule reference for public frontend content. It is a product reference, not a final legal policy. Rules explicitly marked unresolved need owner clarification before implementation.

## Official terminology

| Concept | Official name |
| --- | --- |
| Daily activity | Task |
| Mandatory user-selected consequence | Accountability Action |
| Activated consequence | Recovery Quest |
| Three-day completion period | Recovery Window |
| Recovery protection balance | Grace Points |
| Sustained-discipline reward currency | Discipline Points |
| Experience | XP |
| Progression | Level |
| Progression categories | Ranks |
| Temporary suspension | Emergency Pause |
| Progress analytics | Monthly Analysis |
| Competitive ranking | Leaderboard |
| Progress reset | Progression Reset |

Discipline Points and Grace Points are official names. Use Member or User for a person; identity naming remains undecided.

## 1. Task schedule and cycles

- Members follow a schedule of 7 Tasks per day.
- Every Task is part of a repeating cycle of 1–7 days.
- A 7-day cycle follows Monday through Sunday. Monday is Day 1.
- A Member who joins on Wednesday joins at Day 3 of the 7-day cycle.
- Shorter cycles repeat from their configured Day 1.
- The daily deadline is midnight India Standard Time.
- Members may make up to 3 Task changes per calendar week, Monday through Sunday.
- Every edit, replacement, or rescheduling action counts as a Task change.
- An unfinished Task does not carry forward as an ordinary Task.
- All 7 scheduled Tasks have equal weight in the daily completion percentage.

## 2. Accountability Actions and Recovery Quests

- Every Task must have its own Accountability Action selected by the Member.
- When the original Task is missed, its associated Accountability Action activates as a Recovery Quest.
- Do not generate generic or unrelated Recovery Quests.
- Each Recovery Quest has a 3-day Recovery Window.
- An unfinished Recovery Quest carries forward during its Recovery Window.
- If it is incomplete when the Recovery Window expires, it becomes a failed quest and deducts 1 Grace Point.
- Each Active Recovery Quest drains 7% of the current Level XP requirement at daily reset. Completed, expired and threshold-cleared Quests stop future drains; prior deductions are not reversed.

## 3. Grace Points and Progression Reset

- A Member starts with 3 Grace Points, with no maximum balance.
- An individually expired Recovery Quest deducts 1 Grace Point.
- Up to 5 Active Recovery Quests are allowed. Generating a 6th deducts exactly 1 Grace Point and clears all Active Recovery Quests. Their history remains; cleared Quests do not incur additional per-Quest deductions.
- One Discipline Point can be redeemed for one Grace Point. A successful redemption starts a rolling 72-hour cooldown; a failed redemption does not.
- Exhausting all Grace Points causes a Progression Reset.
- A Progression Reset resets progression while preserving the account.
- A Progression Reset creates a new progression run for one-time Rank-entry reward eligibility, preserves prior reward history and Member Since, and does not break the Discipline Streak.

## 4. XP and completion milestones

- Completing a Task awards base XP.
- Additional XP depends on overall Task completion.
- Bonus XP is awarded at 25%, 50%, 75%, and 100% completion milestones.
- Do not publish or implement numerical XP values or formulas until finalized.
- **Unresolved:** base and bonus amounts, milestone calculation scope/rounding, and the definition of overall Task completion when a Recovery Quest is involved.

## 5. Levels and Ranks

- Level is the progression measure.
- There are seven Ranks.
- The current official working names are Rank 07 Origin, Rank 06 Ember, Rank 05 Surge, Rank 04 Vector, Rank 03 Apex, Rank 02 Zenith and Rank 01 Continuum.
- Rank order is fixed from lowest to highest: Rank 07 Origin, Rank 06 Ember, Rank 05 Surge, Rank 04 Vector, Rank 03 Apex, Rank 02 Zenith, Rank 01 Continuum. Every new Member starts at Rank 07 Origin and progresses toward Rank 01 Continuum, the highest Rank.
- Rank accent palette: Origin `#78C9F2`; Ember `#FF9857`; Surge `#54D7C5`; Vector `#579EFF`; Apex `#A38BFF`; Zenith `#F2C96B`; Continuum uses deep crimson `#450712`, dark crimson `#7F1024`, crimson `#B8203F`, plasma scarlet `#F0443E`, bright highlight `#FF6670`, platinum `#F5FAFF` and dark eclipse shadow `#190D18`.
- Ranks provide rank-specific XP benefits and unique profile badges.
- Each Rank has an original geometric emblem and a collectible badge with its Rank number, name, THE SYSTEM branding, accent colour and a visible serial plate. The reusable frontend badge component is intended for future Member Profile, Dashboard, Leaderboard and Rank Details use.
- Badge visual identities: Origin compass crest; Ember flame crest; Surge three-wave crest; Vector directional diamond; Apex mountain and crown; Zenith SOLAR DIADEM, an elegant rising solar crown with a gold frame and platinum core; Continuum ECLIPSE CROWN, a red-dominant angular celestial crest with a symmetrical crown silhouette, central star core, metallic highlights and eclipse orbit. Approved visual source files are preserved in `design-reference/ranks/` and are recreated as reusable SVG artwork rather than displayed as flattened page images.
- Current Rank rewards are described in §6. Rank-entry XP amounts remain pending configuration. The frontend Level thresholds are demonstration values and are not finalized product thresholds.

### Demonstration rank counts

These frontend values are examples only; they are not live statistics or badge assignments.

| Rank | Demonstration earned-member count |
| --- | ---: |
| 07 Origin | 42,816 |
| 06 Ember | 28,204 |
| 05 Surge | 16,742 |
| 04 Vector | 8,359 |
| 03 Apex | 3,412 |
| 02 Zenith | 1,106 |
| 01 Continuum | 284 |

### Badge serial numbers

- Each earned badge receives a unique serial number within its Rank, with a five-digit suffix and a Rank-specific prefix: Origin `OR`, Ember `EM`, Surge `SU`, Vector `VE`, Apex `AP`, Zenith `ZE`, Continuum `CO` (for example, `OR.00001`).
- Serial sequences are independent between Ranks. The Continuum `CO.00034` and Zenith `ZE.01028` serials are examples shown in the approved badge-preview designs. Mock serials and earned-member counts shown in the frontend are demonstration data, not live statistics or actual assignments.

### Account deletion and badge history

- **Ranks 07–03 (Origin through Apex):** account deletion does not reduce the historical earned-member count. The deleted Member’s serial position remains counted; other Members’ serial numbers do not change. Do not expose the deleted Member’s identity or profile.
- **Ranks 02–01 (Zenith and Continuum):** account deletion removes that Member’s badge entry and reduces that Rank’s earned-member count by exactly one. Within that same Rank only, every remaining serial higher than the deleted serial shifts down by one, leaving no gaps. Serial numbers in other Ranks never shift.
- Example for Zenith: before deletion, `ZE.00005`, `ZE.00006`, `ZE.00007`, `ZE.00008`, `ZE.00009`; deleting `ZE.00007` leaves `ZE.00005`, `ZE.00006`, `ZE.00007`, `ZE.00008`. The former `ZE.00008` holder now has `ZE.00007`.
- These are requirements for future backend implementation only. This frontend milestone does not implement account deletion, live member counts, serial assignment or renumbering.

## 6. Discipline System and Rank Rewards

- A Discipline day qualifies when at least 5 original scheduled Tasks are completed that day. Recovery Quests and Accountability Actions do not count.
- Fewer than 5 completed original scheduled Tasks on a non-paused day breaks the current streak and resets the recurring reward-cycle progress. The longest streak and activity history remain.
- Current and longest streak, total qualifying days, current recurring cycle, total scheduled Tasks completed, DP balance and event history are tracked.
- Recurring cycle values by Rank: Origin: 30 days/+0.25 DP; Ember: 35/+0.40; Surge: 40/+0.50; Vector: 45/+0.60; Apex: 50/+0.70; Zenith: 55/+0.80; Continuum: 60/+0.90. Each cycle repeats. A Rank-up does not change an active cycle; the next cycle uses the new Rank.
- Discipline Points have a shared 4.00 cap. Recurring and Rank-entry rewards award only the remaining room and record the actual amount. Unused points do not expire.
- One-time Rank-entry DP: Origin 0; Ember +0.10; Surge +0.20; Vector +0.30; Apex +0.40; Zenith +0.55; Continuum +0.75. It is claimed once per Rank per progression run. One-time Rank-entry XP is approved as a category but all values remain unconfigured and are not awarded.
- Daily Rank XP benefit: Origin 0.50%; Ember 0.75%; Surge 1.00%; Vector 1.25%; Apex 1.50%; Zenith 1.75%; Continuum 2.00% of the XP needed for the next Level, awarded once per IST calendar day. The benefit is XP only, does not stack and is recalculated when Rank changes. Rounding uses the nearest whole XP.

## 7. Emergency Pause

- Emergency Pause may be activated at most 2 times per calendar month.
- Each activation can last up to 7 consecutive days.
- A protected date does not require five completed Tasks, break the Discipline Streak, or pause/extend the reward countdown. Calendar time continues normally; the activity record marks the date as protected.
- Calendar-month boundary and time-zone handling remain unspecified beyond the daily Discipline boundary being IST.

## 8. Monthly Analysis

Members can compare any available months in their current progression run.

## 9. Leaderboard

The Leaderboard is based on XP, missed Tasks, and failed quests. **Unresolved:** scoring formula, tie handling, update timing, and public display details.

## 10. Proof and verification

- Task completion requires proof.
- Evidence may include photos, videos, documents, external-platform activity, or system-based activity for in-app Tasks.
- OpenAI API may provide AI-assisted image and document verification. External APIs may support trusted activity verification; system-based verification may support in-app Tasks.
- AI does not award XP. Backend validation determines the final verification decision.
- After final verification and successful deletion confirmation, original proof is deleted from THE SYSTEM's storage; a verification receipt without the original proof is retained.
- Third-party providers may process evidence and have separate retention limitations. THE SYSTEM's own storage deletion does not establish deletion from third-party systems; those limits must be disclosed.

## Status and change control

The rules above describe the current product direction and are for frontend information only; there is no backend implementation in this milestone. The UI preview uses session-only browser state and no permanent storage. The activity map shows a rolling 365 IST calendar days while older records remain in history. All legal/policy pages remain drafts pending legal review.
