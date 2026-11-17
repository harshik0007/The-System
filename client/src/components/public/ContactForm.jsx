import { useState } from 'react';

const initial = { name: '', email: '', topic: '', message: '' };
export default function ContactForm() {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!values.name.trim()) next.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.';
    if (!values.topic) next.topic = 'Choose an inquiry type.';
    if (values.message.trim().length < 10) next.message = 'Please enter at least 10 characters.';
    setErrors(next);
    setSubmitted(!Object.keys(next).length);
  }
  const field = (key, label, props = {}) => <label className="contact-field" htmlFor={`contact-${key}`} key={key}>{label}
    {key === 'message' ? <textarea id={`contact-${key}`} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} rows="5" /> : <input id={`contact-${key}`} type={key === 'email' ? 'email' : 'text'} value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} {...props} />}
    {errors[key] && <span className="contact-error" id={`${key}-error`}>{errors[key]}</span>}
  </label>;
  return <form className="contact-form" onSubmit={submit} noValidate>
    {field('name', 'Name', { autoComplete: 'name' })}
    {field('email', 'Email address', { autoComplete: 'email' })}
    <label className="contact-field" htmlFor="contact-topic">Inquiry type<select id="contact-topic" value={values.topic} onChange={(event) => setValues({ ...values, topic: event.target.value })} aria-invalid={Boolean(errors.topic)} aria-describedby={errors.topic ? 'topic-error' : undefined}><option value="">Select a topic</option><option>General inquiry</option><option>Technical issue</option><option>Proof verification dispute</option><option>Account issue</option><option>Privacy request</option><option>Grievance inquiry</option></select>{errors.topic && <span className="contact-error" id="topic-error">{errors.topic}</span>}</label>
    {field('message', 'Message')}
    <button className="public-action" type="submit">Preview message <span aria-hidden="true">→</span></button>
    <p className="contact-note" role={submitted ? 'status' : undefined}>{submitted ? 'Your message passed the preview checks. This form is frontend-only and has not sent or delivered anything.' : 'This form is a frontend-only preview. It does not send or deliver messages.'}</p>
  </form>;
}
