import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionHeading from '../components/SectionHeading.jsx';
import { faqItems } from '../data/productRules.js';

const questions = [
  faqItems.find((item) => item[1] === 'How does the 7-day cycle work?'),
  faqItems.find((item) => item[1] === 'What happens when I miss a Task?'),
  faqItems.find((item) => item[1] === 'What are the seven Ranks?'),
  faqItems.find((item) => item[1] === 'What is THE SYSTEM?'),
].filter(Boolean);

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="faq-section section-wrap" id="faq" aria-labelledby="faq-title">
      <div className="faq-section__heading">
        <SectionHeading id="faq-title" eyebrow="A few things to know" title="Clear answers." accent="Room to begin." description="Start with the essentials. Visit the rulebook for detailed answers about Tasks, recovery, progression, and account privacy." />
        <Link className="faq-section__link" to="/faq">Browse all answers <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="faq-list" role="list">
        {questions.map(([group, question, answer], index) => {
          const isOpen = openIndex === index;
          const answerId = `landing-faq-answer-${index}`;
          return (
            <article className={`faq-card${isOpen ? ' is-open' : ''}`} role="listitem" key={question}>
              <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenIndex(isOpen ? -1 : index)}>
                <span className="faq-card__group">{group}</span><strong>{question}</strong><i aria-hidden="true">{isOpen ? '−' : '+'}</i>
              </button>
              <div className="faq-card__answer" id={answerId} hidden={!isOpen}><p>{answer}</p></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
