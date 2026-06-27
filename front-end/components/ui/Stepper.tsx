"use client";

import React from "react";
import Button from "@/components/ui/Button";

export type StepperStep = {
  title: string;
  children: React.ReactNode;
  description?: string;
};

export type StepperLabels = {
  cancel: string;
  prev: string;
  next: string;
  done: string;
};

type StepperProps = {
  steps: StepperStep[];
  currentStep: number;
  labels: StepperLabels;
  onCancel: () => void;
  onPrev: (targetPage: number) => void;
  onNext: (targetPage: number) => void;
  onDone?: () => void;
  isSubmitting?: boolean;
  isNextDisabled?: boolean;
  doneButtonType?: "button" | "submit";
};

export default function Stepper({
  steps,
  currentStep,
  labels,
  onCancel,
  onPrev,
  onNext,
  onDone,
  isSubmitting = false,
  isNextDisabled = false,
  doneButtonType = "button",
}: StepperProps) {
  const activeStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  if (!activeStep) return null;

  return (
    <div className="space-y-4">
      <div
        className="grid gap-2 rounded-xl bg-surface-variant/40 p-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${index === currentStep ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant"}`}
          >
            {step.title}
          </div>
        ))}
      </div>

      {activeStep.description && <p className="text-on-surface-variant text-body-sm">{activeStep.description}</p>}
      <div>{activeStep.children}</div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {labels.cancel}
        </Button>

        {currentStep > 0 && (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onPrev(currentStep - 1)}
            disabled={isSubmitting}
          >
            {labels.prev}
          </Button>
        )}

        {!isLastStep ? (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onNext(currentStep + 1)}
            disabled={isSubmitting || isNextDisabled}
          >
            {labels.next}
          </Button>
        ) : (
          <Button
            type={doneButtonType}
            className="w-full sm:w-auto"
            onClick={doneButtonType === "button" ? onDone : undefined}
            disabled={isSubmitting}
          >
            {labels.done}
          </Button>
        )}
      </div>
    </div>
  );
}
