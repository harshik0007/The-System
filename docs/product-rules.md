# THE SYSTEM — Product Rules

This document is the current product-rule reference for public frontend content. It is a product reference, not a final legal policy. Rules explicitly marked unresolved need owner clarification before implementation.

## Official terminology

| Concept | Official name |
| --- | --- |
| Daily activity | Task |
| Mandatory user-selected consequence | Accountability Action |
| Activated consequence | Recovery Quest |
| Three-day completion period | Recovery Window |
| Remaining missed-task chances | Grace Charges |
| Sustained-discipline reward currency | Discipline Points |
| Experience | XP |
| Progression | Level |
| Progression categories | Ranks |
| Temporary suspension | Emergency Pause |
| Progress analytics | Monthly Analysis |
| Competitive ranking | Leaderboard |
| Progress reset | Progression Reset |

Discipline Points and Grace Charges are official names and must not be renamed. Use Member or User for a person; identity naming remains undecided.

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
- If it is incomplete when the Recovery Window expires, it becomes a failed quest and deducts 1 Grace Charge.

## 3. Grace Charges and Progression Reset

- A Member starts with 3 Grace Charges.
- If the System detects 3 failed quests in a day, deduct another 1 Grace Charge.
- Both deductions can occur on the same day: an expired Recovery Quest can deduct 1, while the 3-failed-quests condition deducts another 1. Therefore, 2 Grace Charges can be deducted in one day when both triggers apply.
- Exhausting all Grace Charges causes a Progression Reset.
- A Progression Reset resets progression while preserving the account.
- **Unresolved:** which exact progression fields reset, and whether the failed-quest daily threshold can trigger more than once on the same calendar day if additional groups of three are detected.

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
- **Unresolved:** Rank thresholds, exact XP benefits, and whether a Progression Reset changes profile badge history. No qualification thresholds or numerical XP benefits are assigned here.

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

## 6. Discipline Points

- Every three months of discipline awards 0.25 Discipline Points.
- The maximum stored Discipline Points balance is 10.
- **Unresolved:** the qualification test for a three-month period of discipline, including continuity and any exceptions.

## 7. Emergency Pause

- Emergency Pause may be activated at most 2 times per calendar month.
- Each activation can last up to 7 consecutive days.
- **Unresolved in this update:** whether Task completion, Recovery Windows, XP awards, and other progression activity pause or continue during an Emergency Pause; calendar-month boundary and time-zone handling.

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

The rules above describe the current product direction and are for frontend information only; there is no backend implementation in this milestone. Do not restore prior rules that conflict with this document. The specific unresolved mechanics listed above need owner decisions. All legal/policy pages remain drafts pending legal review.
