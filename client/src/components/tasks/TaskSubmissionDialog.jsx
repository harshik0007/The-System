import { useEffect, useRef, useState } from 'react';
import AppIcon from '../app/AppIcon.jsx';

export default function TaskSubmissionDialog({ task, onClose, onSubmit, saving = false, error = '' }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState('edit');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    setStep('edit');
    setNote('');
    setFile(null);
  }, [task?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (task && !dialog.open) dialog.showModal();
    if (!task && dialog.open) dialog.close();
  }, [task]);

  if (!task) return <dialog className="task-submission-dialog" ref={dialogRef} />;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (step === 'edit') {
      setStep('review');
      return;
    }
    onSubmit(task.occurrenceId || task.id, { note: note.trim(), fileName: file?.name || '' });
  };

  return (
    <dialog className="task-submission-dialog" ref={dialogRef} aria-labelledby="task-submission-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <form className="task-submission" onSubmit={handleSubmit}>
        <div className="task-submission__header">
          <div><p className="app-eyebrow">TASK COMPLETION</p><h2 id="task-submission-title">{step === 'edit' ? 'Submit proof' : 'Review completion'}</h2><p>{task.name}</p></div>
          <button className="task-submission__close" type="button" aria-label="Close submission dialog" onClick={onClose}><AppIcon name="close" /></button>
        </div>

        {step === 'edit' ? (
          <>
            <label className="task-submission__field">Completion note <span>Optional</span><textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note about this completion…" /></label>
            <label className="task-submission__field">Supporting proof <span>Optional</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>Optional for now. The selected file is not uploaded; only its name is recorded.</small></label>
          </>
        ) : (
          <div className="task-submission__review">
            <p><span>Completion note</span><strong>{note || 'No note added'}</strong></p>
            <p><span>Supporting proof</span><strong>{file?.name || 'No file selected'}</strong></p>
            <div><AppIcon name="shield" /><p>Submitting records this Task as <strong>Completed immediately</strong>. The note and file name are optional; AI review and XP awards are not active.</p></div>
          </div>
        )}

        {error && <p className="task-change-validation" role="alert">{error}</p>}

        <div className="task-submission__actions">
          <button className="task-submission__back" type="button" onClick={step === 'review' ? () => setStep('edit') : onClose} disabled={saving}>{step === 'review' ? 'Back to edit' : 'Cancel'}</button>
          <button className="task-submit-button" type="submit" disabled={saving}>{saving ? 'Submitting…' : step === 'edit' ? 'Review completion' : 'Submit'}<AppIcon name="arrow" /></button>
        </div>
      </form>
    </dialog>
  );
}
