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
  onStepChange?: (targetPage: number) => void;
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
  onStepChange,
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
    <div className="space-y-6">
      <div className="rounded-[22px] border border-outline-variant bg-surface-container-high/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="type-label-caps text-secondary-fixed-dim">Progresso</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Passo {currentStep + 1} de {steps.length}
            </p>
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-variant">
            <div
              className="h-full rounded-full bg-primary-container transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={step.title}
                type="button"
                onClick={() => onStepChange?.(index)}
                disabled={isSubmitting || !onStepChange}
                className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-primary-fixed-dim/30 bg-primary-fixed-dim/10"
                    : "border-outline-variant bg-surface-container"
                } ${onStepChange ? "hover:border-primary-fixed-dim/40 hover:bg-surface-variant/50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${
                      isActive || isCompleted
                        ? "bg-primary-container text-on-primary-fixed"
                        : "bg-surface-variant text-on-surface-variant"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-on-surface-variant"}`}>
                      {step.title}
                    </p>
                    {step.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant/80">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[22px] border border-outline-variant bg-surface-container p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
        <div className="mb-5">
          <p className="type-label-caps text-secondary-fixed-dim">Etapa atual</p>
          <h4 className="mt-2 text-xl font-semibold text-primary">{activeStep.title}</h4>
          {activeStep.description ? (
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{activeStep.description}</p>
          ) : null}
        </div>
        <div>{activeStep.children}</div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-outline-variant/70 pt-4 sm:flex-row sm:justify-end">
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
            {isSubmitting ? "Salvando..." : labels.done}
          </Button>
        )}
      </div>
    </div>
  );
}
