import { useEffect, useRef, useState } from 'react';
import AppIcon from '../app/AppIcon.jsx';

export default function TaskSubmissionDialog({ task, onClose, onSubmit }) {
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
    onSubmit(task.id, { note: note.trim(), fileName: file?.name || '' });
  };

  return (
    <dialog className="task-submission-dialog" ref={dialogRef} aria-labelledby="task-submission-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <form className="task-submission" onSubmit={handleSubmit}>
        <div className="task-submission__header">
          <div><p className="app-eyebrow">COMPLETION · FRONTEND PREVIEW</p><h2 id="task-submission-title">{step === 'edit' ? 'Submit completion' : 'Review your submission'}</h2><p>{task.name}</p></div>
          <button className="task-submission__close" type="button" aria-label="Close submission dialog" onClick={onClose}><AppIcon name="close" /></button>
        </div>

        {step === 'edit' ? (
          <>
            <label className="task-submission__field">Completion note <span>Optional</span><textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note about this completion…" /></label>
            <label className="task-submission__field">Supporting proof <span>Optional</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>Preview only. This file remains on this device and is not uploaded.</small></label>
          </>
        ) : (
          <div className="task-submission__review">
            <p><span>Completion note</span><strong>{note || 'No note added'}</strong></p>
            <p><span>Supporting proof</span><strong>{file?.name || 'No file selected'}</strong></p>
            <div><AppIcon name="shield" /><p>This example will be marked <strong>Submitted for verification</strong>. It will not be shown as verified and no XP is awarded in this preview.</p></div>
          </div>
        )}

        <div className="task-submission__actions">
          {step === 'review' && <button className="task-submission__back" type="button" onClick={() => setStep('edit')}>Back to edit</button>}
          <button className="task-submit-button" type="submit">{step === 'edit' ? 'Review submission' : 'Submit example'}<AppIcon name="arrow" /></button>
        </div>
      </form>
    </dialog>
  );
}
