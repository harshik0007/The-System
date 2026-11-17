const draft = 'Draft — pending legal review';

export const legalDocuments = {
  terms: { title: 'Terms & Conditions', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. This is a product-planning draft, not final legally binding terms. No legal entity, governing law, jurisdiction, or effective date is stated here.`],
    ['service', 'Service overview', 'THE SYSTEM is being designed around daily Tasks, user-selected Accountability Actions, Recovery Quests and progression. Features may remain unavailable until implemented.'],
    ['tasks', 'Tasks and changes', 'The current product design schedules 7 Tasks per day in a repeating 1–7-day cycle. The daily deadline is midnight India Standard Time. Up to 3 changes are allowed per Monday–Sunday calendar week; edits, replacements and rescheduling each count as a change.'],
    ['recovery', 'Recovery and Grace Charges', 'Each Task has its own user-selected Accountability Action. Missing a Task activates its associated Recovery Quest with a 3-day Recovery Window. Grace Charges start at 3. Exhausting them causes a Progression Reset that preserves the account.'],
    ['progression', 'XP and Ranks', 'Tasks award base XP, with additional XP based on overall Task completion and bonuses at 25%, 50%, 75% and 100%. Exact numerical XP formulas are not specified. Rank progression starts at Rank 07 Origin and advances through Ember, Surge, Vector, Apex and Zenith to Rank 01 Continuum. Each Rank has a rank-specific benefit and unique profile badge; exact benefits and qualification thresholds are not specified.'],
    ['review', 'Items for review', 'Operator identity, jurisdiction, dispute processes, user eligibility, service availability, changes, liability, termination and other binding terms require approved content and professional review. No subscription, payment, refund or cancellation terms are included because these features are not established.'],
  ] },
  privacy: { title: 'Privacy Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. This is not a compliance statement or final privacy notice. The product is not ready to make public legal-compliance claims.`],
    ['data', 'Information the product may handle', 'The proposed product may handle account details, Task schedules, Accountability Actions, evidence submissions, verification outcomes, XP, Grace Charges, progression records and technical diagnostics. Exact fields and purposes require confirmation before launch.'],
    ['evidence', 'Evidence handling', 'Original proof is intended to be deleted from THE SYSTEM storage after final verification and successful deletion confirmation. A verification receipt without the original proof is retained. A deletion confirmation for our storage does not control copies or retention held by third-party processors.'],
    ['third-parties', 'Third-party processing', 'OpenAI API may assist with image or document verification; external platform APIs may verify activity. Evidence sent to a provider can be processed under that provider’s systems and retention practices. Exact providers, terms and retention must be confirmed and disclosed before use.'],
    ['retention', 'Retention and deletion', 'Account data, receipts, backups, operational logs and request handling periods have not been finalized. See the Data Retention draft. Progression Reset preserves the account while resetting progression; its exact data scope is not yet defined.'],
    ['rights', 'Requests and contact', 'Available privacy rights and request processes depend on the operating jurisdiction and require approval. No contact address or privacy officer is designated in this draft.'],
  ] },
  cookies: { title: 'Cookie Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. This draft does not claim that the service uses or does not use particular cookies.`],
    ['purpose', 'Potential storage technologies', 'The current public experience may use browser storage or essential technologies required by the application. Production analytics, advertising, preference storage and third-party technologies have not been finalized.'],
    ['controls', 'Browser controls', 'Browsers provide controls to view and clear stored site data. The final policy should identify each technology, purpose, duration and provider before deployment.'],
    ['review', 'Before launch', 'Audit the production client and its vendors, determine applicable consent requirements, then replace this draft with approved disclosure.'],
  ] },
  'acceptable-use': { title: 'Acceptable Use Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. This is proposed guidance, not a finalized enforcement policy.`],
    ['conduct', 'Safe, respectful Accountability Actions', 'Choose Accountability Actions that are safe, reasonable and respectful of other people. An action must be chosen by the Member for its Task; unrelated generic Recovery Quests are not generated.'],
    ['evidence', 'Evidence integrity', 'Submit evidence relevant to the Task and do not knowingly manipulate submissions or attempt duplicate XP awards. Exact review and dispute processes remain unresolved.'],
    ['enforcement', 'Enforcement', 'Operational review and enforcement procedures require product and legal approval. Exhausting Grace Charges causes a Progression Reset that preserves the account.'],
  ] },
  'community-guidelines': { title: 'Community Guidelines', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. Community features and moderation operations are not established.`],
    ['respect', 'Respect and safety', 'Choose Accountability Actions that respect your wellbeing, other people’s boundaries and safety. An action should not require another person to participate or disclose private information.'],
    ['identity', 'Member identity', 'Member or User are neutral terms while identity naming is undecided. The seven identity-name candidates are not official and should not be treated as product or Rank names.'],
    ['support', 'Reporting and moderation', 'Reporting channels, moderation staffing, response times and appeals have not been defined. No availability promise is made.'],
  ] },
  'proof-verification': { title: 'Proof Verification Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. Evidence methods and operational handling remain subject to implementation.`],
    ['evidence', 'Evidence types', 'Task evidence may include photos, videos, documents, trusted external-platform activity, or system-based activity for in-app Tasks.'],
    ['review', 'Review and final decision', 'AI-assisted image and document review may support assessment; external APIs may verify trusted platform activity. AI does not award XP. Backend validation determines the final verification decision.'],
    ['deletion', 'Original proof deletion', 'After final verification and successful deletion confirmation, original proof is intended to be deleted from THE SYSTEM storage. A verification receipt without the original is retained.'],
    ['limits', 'Provider limitations', 'Evidence sent to third parties can be processed or retained under provider-side policies. THE SYSTEM’s storage deletion cannot guarantee deletion from third-party systems. Provider, retention, security, dispute and exception details must be approved and disclosed.'],
  ] },
  'ai-disclosure': { title: 'AI & Proof Verification Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. No provider retention or compliance guarantee is made in this draft.`],
    ['role', 'AI’s proposed role', 'OpenAI API may provide AI-assisted image and document verification. AI supports review and does not award XP or make the final decision. Backend validation determines the final result.'],
    ['processing', 'Third-party processing', 'Evidence submitted for AI review may be transmitted to a third-party provider and processed on provider infrastructure. Provider-side retention or use may differ from THE SYSTEM’s storage handling. Exact provider terms and retention must be checked and disclosed before launch.'],
    ['deletion', 'Deletion boundary', 'THE SYSTEM intends to delete original proof from its own storage after final verification and successful deletion confirmation, while retaining a receipt without the original. This does not imply provider-side deletion.'],
    ['review', 'Review and correction', 'The final review, correction, dispute and exception flows are not yet defined. AI assistance is not an assurance of accuracy.'],
  ] },
  'data-retention': { title: 'Data Retention & Deletion', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. Retention durations, backups and operational procedures have not been finalized.`],
    ['proof', 'Original evidence', 'Original proof is intended to be deleted from THE SYSTEM storage after final verification and successful deletion confirmation. A verification receipt without the original proof is retained.'],
    ['provider', 'Third-party copies', 'Evidence processed by an AI or external provider may be retained under provider-side policies. THE SYSTEM cannot promise that its own deletion confirmation removes third-party copies. Provider settings, terms and timelines require review and clear disclosure.'],
    ['account', 'Account and operational records', 'Retention periods for account details, receipts, progression records, backups and logs, along with deletion request handling, remain unresolved. A Progression Reset preserves the account.'],
  ] },
  'account-reset': { title: 'Account & Progression Reset Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. Progression Reset controls and support process are not implemented.`],
    ['trigger', 'Progression Reset trigger', 'Exhausting all Grace Charges causes a Progression Reset. It resets progression while preserving the Member’s account.'],
    ['scope', 'Reset scope', 'The exact progression fields that reset and the treatment of history, profile badges, Task cycles and other records have not been specified.'],
    ['manual-reset', 'Other reset requests', 'A self-service reset or manually requested progression reset has not been established. No other reset outcome is promised.'],
  ] },
  grievance: { title: 'Grievance Policy', updated: 'Draft for review', sections: [
    ['status', 'Document status', `${draft}. No grievance officer, address, email or response timeline is designated. Do not infer a legal contact from this draft.`],
    ['contact', 'Grievance inquiries', 'A contact form is available as a frontend-only preview and does not send or deliver messages. A real grievance channel and responsible contact must be established before the product relies on this page.'],
    ['review', 'Review process', 'Receipt confirmation, evidence requirements, response times, escalation and outcomes have not been defined.'],
    ['issues', 'Potential inquiry topics', 'A future channel may address privacy requests, account issues, Task or Recovery Quest disputes, accessibility or safety concerns, subject to an approved process.'],
  ] },
};
