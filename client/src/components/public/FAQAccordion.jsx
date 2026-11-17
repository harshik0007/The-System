import { useMemo, useState } from 'react';
import { faqItems } from '../../data/productRules.js';

export default function FAQAccordion() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...new Set(faqItems.map(([group]) => group))];
  const items = useMemo(() => faqItems.filter(([group, question, answer]) =>
    (category === 'All' || group === category) && `${question} ${answer}`.toLowerCase().includes(query.toLowerCase().trim())), [query, category]);
  return <div className="faq-tool">
    <label className="faq-search">Search questions<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the rules…" /></label>
    <div className="faq-categories" aria-label="Filter questions by category">{categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="faq-list">{items.map(([group, question, answer]) => <details className="faq-item" key={question}><summary><span className="faq-item__group">{group}</span><span>{question}</span><b aria-hidden="true">+</b></summary><div className="faq-item__answer"><p>{answer}</p></div></details>)}</div>
    {!items.length && <p className="public-empty">No questions match that search.</p>}
  </div>;
}
