"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, HelpCircle, ListChecks, SkipForward } from "lucide-react";
import type { PlanQuestionItem, PlanWizardAnswer } from "@/components/app/app-home-types";

interface PlanWizardProps {
  questions: PlanQuestionItem[];
  onSubmit: (answers: PlanWizardAnswer[]) => void;
  onSkip: () => void;
}

// R15 C6 — batch clarifying-questions wizard: one question at a time with
// Next/Back over locally-editable answers, then a Review step listing every
// Q+A before the single summary message is sent (replaces the old one-
// question-per-turn auto-send in Composer.tsx).
export function PlanWizard({ questions, onSubmit, onSkip }: PlanWizardProps) {
  const [step, setStep] = useState(0); // 0..questions.length-1 = a question, questions.length = Review
  const [answers, setAnswers] = useState<(string | null)[]>(() => questions.map(() => null));
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState("");
  // When editing a single answer from the Review step, jump straight back to
  // Review afterward instead of replaying the rest of the wizard forward.
  const [returnToReview, setReturnToReview] = useState(false);

  const isReview = step >= questions.length;
  const current = questions[step];

  const openStep = (index: number, fromReview: boolean) => {
    const existing = answers[index];
    const isCustom = existing != null && !questions[index]?.choices.includes(existing);
    setOtherMode(isCustom);
    setOtherText(isCustom ? existing! : "");
    setReturnToReview(fromReview);
    setStep(index);
  };

  const commitAnswer = (answer: string) => {
    if (!answer.trim()) return;
    const next = [...answers];
    next[step] = answer.trim();
    setAnswers(next);
    if (returnToReview) {
      setStep(questions.length);
    } else {
      setStep(step + 1);
    }
    setOtherMode(false);
    setOtherText("");
  };

  if (isReview) {
    return (
      <div className="plan-question-card" role="group" aria-label="Review answers">
        <div className="plan-card-head">
          <ListChecks className="w-4 h-4" />
          <span className="plan-card-title">Review your answers</span>
        </div>
        <ol className="plan-wizard-review">
          {questions.map((q, i) => (
            <li key={i} className="plan-wizard-review-item">
              <span className="plan-wizard-review-q">{q.question}</span>
              <span className="plan-wizard-review-a">{answers[i]}</span>
              <button type="button" className="plan-wizard-edit" onClick={() => openStep(i, true)}>
                Edit
              </button>
            </li>
          ))}
        </ol>
        <div className="plan-card-actions">
          <button
            type="button"
            className="plan-btn adjust"
            onClick={() => openStep(questions.length - 1, false)}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            type="button"
            className="plan-btn run"
            onClick={() => onSubmit(questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? "" })))}
          >
            Submit answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="plan-question-card" role="group" aria-label="Clarifying question">
      <div className="plan-card-head">
        <HelpCircle className="w-4 h-4" />
        <span className="plan-card-title">Quick question</span>
        <span className="plan-wizard-steps">
          Question {step + 1} of {questions.length}
        </span>
      </div>
      <p className="plan-card-desc">{current.question}</p>
      <div className="plan-question-options">
        {current.choices.slice(0, 3).map((choice, i) => (
          <button
            key={`${step}-${i}`}
            type="button"
            className={`plan-question-option${current.recommended === choice ? " recommended" : ""}${
              !otherMode && answers[step] === choice ? " selected" : ""
            }`}
            onClick={() => commitAnswer(choice)}
          >
            {choice}
            {current.recommended === choice && <span className="plan-question-badge">Recommended</span>}
          </button>
        ))}
        <div className="plan-question-other">
          <input
            type="text"
            value={otherText}
            onChange={(e) => {
              setOtherMode(true);
              setOtherText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAnswer(otherText);
              }
            }}
            placeholder="Other — type your own answer"
            className="plan-question-other-input"
          />
          <button
            type="button"
            className="plan-btn adjust"
            disabled={!otherText.trim()}
            onClick={() => commitAnswer(otherText)}
          >
            <ArrowRight className="w-3.5 h-3.5" /> Next
          </button>
        </div>
      </div>
      <div className="plan-wizard-nav">
        {step > 0 && (
          <button type="button" className="plan-question-skip" onClick={() => openStep(step - 1, false)}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
        <button type="button" className="plan-question-skip" onClick={onSkip}>
          <SkipForward className="w-3.5 h-3.5" /> Skip to plan
        </button>
      </div>
    </div>
  );
}
