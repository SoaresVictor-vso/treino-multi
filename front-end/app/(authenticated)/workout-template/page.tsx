"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  RiAddLine,
  RiHeartPulseLine,
  RiCheckLine,
  RiCloseLine,
} from "react-icons/ri";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import TemplatePreview from "@/components/workout-template/TemplatePreview";
import TemplateStats from "@/components/workout-template/TemplateStats";
import TemplatesTable from "@/components/workout-template/TemplatesTable";
import type {
  Template,
  TemplateModalState,
} from "@/components/workout-template/types";
import { exercises, metricLabels, metricUnits } from "./mocks";
import type { Activity, CreateWorkoutTemplateDto, Exercise } from "./types";
import { ParametersService } from "@/api/services/parametro";

type RegisterType = "p" | "v";
type ExerciseConfig = {
  metric1: string;
  metric2: string;
  pse: string;
  metric2Type: RegisterType;
  rest: number;
};

const DEFAULT_REST_DURATION = 90;

function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function timeToSeconds(time: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}
const initialTemplates: Template[] = [
  {
    id: 1,
    title: "Força · Membros inferiores",
    description:
      "Base de força para membros inferiores com foco em controle e progressão.",
    exercises: [exercises[0], exercises[2]],
    activities: [
      {
        exercise: 1,
        metric_1: 10,
        metric_2: 60,
        type_1: "v",
        type_2: "v",
        pse: 7,
      },
      {
        exercise: 1,
        metric_1: 8,
        metric_2: 70,
        type_1: "v",
        type_2: "v",
        pse: 8,
      },
      {
        exercise: 3,
        metric_1: 8,
        metric_2: 80,
        type_1: "v",
        type_2: "v",
        pse: 8,
      },
    ],
  },
  {
    id: 2,
    title: "Condicionamento · HIIT",
    description:
      "Circuito intervalado para elevar a capacidade cardiovascular.",
    exercises: [exercises[3]],
    activities: [
      {
        exercise: 4,
        metric_1: 2,
        metric_2: 5,
        type_1: "v",
        type_2: "v",
        pse: 8,
      },
      {
        exercise: 4,
        metric_1: 1,
        metric_2: 4.5,
        type_1: "v",
        type_2: "v",
        pse: 9,
      },
    ],
  },
];

function getExercisesFromActivities(activities: Activity[]) {
  return activities.reduce<Exercise[]>((items, activity) => {
    const exercise = exercises.find((item) => item.id === activity.exercise);
    return exercise && !items.some((item) => item.id === exercise.id)
      ? [...items, exercise]
      : items;
  }, []);
}

function getConfigsFromActivities(activities: Activity[]) {
  return activities.reduce<Record<number, ExerciseConfig[]>>(
    (configs, activity) => {
      const config: ExerciseConfig = {
        metric1: activity.metric_1?.toString() ?? "",
        metric2: activity.metric_2?.toString() ?? "",
        pse: activity.pse?.toString() ?? "",
        metric2Type: activity.type_2 ?? "p",
        rest: activity.rest_duration ?? DEFAULT_REST_DURATION,
      };
      return {
        ...configs,
        [activity.exercise]: [...(configs[activity.exercise] ?? []), config],
      };
    },
    {},
  );
}

export default function WorkoutTemplatePage() {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selected, setSelected] = useState(initialTemplates[0]);
  const [templateModal, setTemplateModal] = useState<TemplateModalState | null>(
    null,
  );
  const [actionsTemplate, setActionsTemplate] = useState<Template | null>(null);
  const [templateToRemove, setTemplateToRemove] = useState<Template | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () =>
      templates.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [templates, query],
  );
  const saveTemplate = (workoutTemplate: CreateWorkoutTemplateDto) => {
    console.log("DTO de criação da WorkoutTemplate:", workoutTemplate);

    const saved: Template = {
      id: Date.now(),
      title: workoutTemplate.name,
      description: workoutTemplate.description,
      exercises: getExercisesFromActivities(workoutTemplate.activities),
      activities: workoutTemplate.activities,
    };
    setTemplates((current) => [...current, saved]);
    setSelected(saved);
    setCreateOpen(false);
  };
  const updateTemplate = (
    id: number,
    workoutTemplate: CreateWorkoutTemplateDto,
  ) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === id
          ? {
              ...template,
              title: workoutTemplate.name,
              description: workoutTemplate.description,
              exercises: getExercisesFromActivities(workoutTemplate.activities),
              activities: workoutTemplate.activities,
            }
          : template,
      ),
    );
    setSelected((current) =>
      current.id === id
        ? {
            ...current,
            title: workoutTemplate.name,
            description: workoutTemplate.description,
            exercises: getExercisesFromActivities(workoutTemplate.activities),
            activities: workoutTemplate.activities,
          }
        : current,
    );
    setTemplateModal(null);
  };
  const removeTemplate = (template: Template) => {
    setTemplates((current) =>
      current.filter((item) => item.id !== template.id),
    );
    setSelected((current) =>
      current.id === template.id
        ? (templates.find((item) => item.id !== template.id) ?? current)
        : current,
    );
    setTemplateToRemove(null);
  };

  useEffect(() => {
    new ParametersService().search("metrics").then((data) => {
      console.log("data", data);
    });
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="type-label-caps text-primary-fixed-dim">
            Biblioteca de treinos
          </p>
          <h1 className="type-headline-lg mt-2">Templates de treino</h1>
          <p className="mt-2 max-w-xl text-on-surface-variant">
            Crie e reutilize estruturas de treino para acelerar a prescrição dos
            seus alunos.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <RiAddLine size={20} /> Nova template
        </Button>
      </header>
      <TemplateStats
        templateCount={templates.length}
        exerciseCount={templates.reduce(
          (total, item) => total + item.exercises.length,
          0,
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TemplatesTable
          templates={filtered}
          selectedId={selected.id}
          query={query}
          actionsTemplateId={actionsTemplate?.id ?? null}
          onQueryChange={setQuery}
          onSelect={setSelected}
          onToggleActions={(template) =>
            setActionsTemplate((current) =>
              current?.id === template.id ? null : template,
            )
          }
          onEdit={(template) => {
            setTemplateModal({ mode: "edit", template });
            setActionsTemplate(null);
          }}
          onView={(template) => {
            setTemplateModal({ mode: "view", template });
            setActionsTemplate(null);
          }}
          onRemove={(template) => {
            setTemplateToRemove(template);
            setActionsTemplate(null);
          }}
        />
        <TemplatePreview template={selected} />
      </div>
      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onSave={saveTemplate}
        />
      )}
      {templateModal && (
        <CreateModal
          key={`${templateModal.mode}-${templateModal.template.id}`}
          template={templateModal.template}
          mode={templateModal.mode}
          onClose={() => setTemplateModal(null)}
          onSave={(workoutTemplate) =>
            updateTemplate(templateModal.template.id, workoutTemplate)
          }
        />
      )}
      {templateToRemove && (
        <Modal
          isOpen
          title="Remover template"
          description={`Deseja remover a template ${templateToRemove.title}? Esta ação não poderá ser desfeita.`}
          onClose={() => setTemplateToRemove(null)}
        >
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTemplateToRemove(null)}>
              Cancelar
            </Button>
            <Button onClick={() => removeTemplate(templateToRemove)}>
              Remover
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateModal({
  onClose,
  onSave,
  template,
  mode = "create",
}: {
  onClose: () => void;
  onSave: (workoutTemplate: CreateWorkoutTemplateDto) => void;
  template?: Template;
  mode?: "create" | "view" | "edit";
}) {
  const isViewMode = mode === "view";
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [selected, setSelected] = useState<Exercise[]>(
    template?.exercises ?? [],
  );
  const [configs, setConfigs] = useState<Record<number, ExerciseConfig[]>>(() =>
    getConfigsFromActivities(template?.activities ?? []),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const newConfig = (): ExerciseConfig => ({
    metric1: "",
    metric2: "",
    pse: "",
    metric2Type: "p",
    rest: DEFAULT_REST_DURATION,
  });
  const toggle = (exercise: Exercise) =>
    setSelected((current) => {
      const isSelected = current.some((item) => item.id === exercise.id);
      if (isSelected) {
        setConfigs((items) => {
          const next = { ...items };
          delete next[exercise.id];
          return next;
        });
        return current.filter((item) => item.id !== exercise.id);
      }
      setConfigs((items) => ({ ...items, [exercise.id]: [newConfig()] }));
      return [...current, exercise];
    });
  const updateConfig = (
    exerciseId: number,
    index: number,
    key: keyof ExerciseConfig,
    value: string | number,
  ) =>
    setConfigs((current) => ({
      ...current,
      [exerciseId]: (current[exerciseId] ?? [newConfig()]).map(
        (item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  const addConfig = (exerciseId: number) => {
    setConfigs((current) => {
      const blocks = current[exerciseId] ?? [newConfig()];
      return {
        ...current,
        [exerciseId]: [...blocks, { ...blocks[blocks.length - 1] }],
      };
    });
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-exercise-id="${exerciseId}"] [data-block-index="${configs[exerciseId]?.length ?? 1}"] input`,
      );
      input?.focus();
      input?.select();
    });
  };
  const moveToNextField = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.target instanceof HTMLTextAreaElement)
      return;
    event.preventDefault();
    const exerciseContainer = (
      event.target as HTMLElement
    ).closest<HTMLElement>("[data-exercise-id]");
    const inputs = Array.from(
      (
        exerciseContainer ?? event.currentTarget
      ).querySelectorAll<HTMLInputElement>("input"),
    );
    const currentIndex = inputs.indexOf(event.target as HTMLInputElement);
    if (exerciseContainer && currentIndex === inputs.length - 1) {
      const addBlockButton =
        exerciseContainer.querySelector<HTMLButtonElement>("[data-add-block]");
      addBlockButton?.click();
      return;
    }
    inputs[currentIndex + 1]?.focus();
    inputs[currentIndex + 1]?.select();
  };
  const createWorkoutTemplate = () => {
    const toNumber = (value: string) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    };

    onSave({
      name: title.trim(),
      description: description.trim(),
      activities: selected.flatMap((exercise) =>
        (configs[exercise.id] ?? [newConfig()]).map((config) => ({
          exercise: exercise.id,
          metric_1: toNumber(config.metric1),
          ...(exercise.metric_2
            ? {
                metric_2: toNumber(config.metric2),
                type_2: config.metric2Type,
              }
            : {}),
          type_1: "v",
          pse: toNumber(config.pse),
          rest_duration: config.rest,
        })),
      ),
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl"
        onKeyDown={moveToNextField}
      >
        <div className="mb-6 flex justify-between border-b border-outline-variant pb-5">
          <div>
            <p className="type-label-caps text-primary-fixed-dim">
              {mode === "create" ? "Nova template" : "Template de treino"}
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {mode === "create"
                ? "Cadastrar template de treino"
                : isViewMode
                  ? "Visualizar template de treino"
                  : "Editar template de treino"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-on-surface-variant hover:text-primary"
          >
            <RiCloseLine size={24} />
          </button>
        </div>
        <fieldset
          disabled={isViewMode}
          className="space-y-4 disabled:opacity-75"
        >
          <Input
            label="Nome"
            value={title}
            maxLength={100}
            onChange={(ev) => setTitle(ev.target.value)}
            placeholder="Ex.: Força · Membros superiores"
          />
          <Textarea
            label="Descrição"
            value={description}
            maxLength={255}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descreva o objetivo do treino"
            rows={3}
          />
        </fieldset>
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="type-headline-md">
              Exercícios{" "}
              <span className="ml-2 text-sm font-normal text-on-surface-variant">
                {selected.length}
              </span>
            </h3>
            {!isViewMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                <RiAddLine /> Adicionar exercício
              </Button>
            )}
          </div>
          <div className="mt-3 space-y-4">
            {selected.map((item, index) => (
              <div
                key={item.id}
                data-exercise-id={item.id}
                className="rounded border border-outline-variant bg-surface-container-low p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 font-mono text-primary-fixed-dim">
                    {index + 1}.
                  </span>
                  <span className="text-on-surface-variant">
                    <RiHeartPulseLine />
                  </span>
                  <span className="font-semibold">{item.name}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {(configs[item.id] ?? [newConfig()]).map(
                    (config, configIndex) => (
                      <ConfigBlock
                        key={`${item.id}-${configIndex}`}
                        exercise={item}
                        index={configIndex}
                        config={config}
                        disabled={isViewMode}
                        onChange={(key, value) =>
                          updateConfig(item.id, configIndex, key, value)
                        }
                      />
                    ),
                  )}
                </div>
                {!isViewMode && (
                  <>
                    <button
                      type="button"
                      data-add-block
                      onClick={() => addConfig(item.id)}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
                    >
                      <RiAddLine /> Adicionar outro bloco
                    </button>
                  </>
                )}
              </div>
            ))}
            {!selected.length && (
              <p className="rounded border border-dashed border-outline-variant p-5 text-center text-sm text-on-surface-variant">
                Adicione os exercícios na ordem em que serão executados.
              </p>
            )}
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-3 border-t border-outline-variant pt-5">
          <Button variant="outline" onClick={onClose}>
            {isViewMode ? "Fechar" : "Cancelar"}
          </Button>
          {!isViewMode && (
            <Button disabled={!title.trim()} onClick={createWorkoutTemplate}>
              {mode === "edit" ? "Salvar alterações" : "Criar template"}
            </Button>
          )}
        </div>
        {pickerOpen && (
          <ExercisePicker
            selected={selected}
            onToggle={toggle}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function ConfigBlock({
  exercise,
  index,
  config,
  disabled = false,
  onChange,
}: {
  exercise: Exercise;
  index: number;
  config: ExerciseConfig;
  disabled?: boolean;
  onChange: (key: keyof ExerciseConfig, value: string | number) => void;
}) {
  const metric_1 = metricLabels[exercise?.metric_1] || exercise?.metric_1;
  const metric_2 =
    (exercise?.metric_2 && metricLabels[exercise?.metric_2]) ||
    exercise?.metric_2;
  return (
    <div
      data-block-index={index}
      className="rounded border border-outline-variant bg-surface-container-high px-2 py-1.5"
    >
      <div className="grid items-end gap-2 grid-cols-[28px_1fr_1fr_1fr_1fr]">
        <div className="flex items-center justify-center my-auto">
          <Badge label={`${index + 1}`} type="primary" />
        </div>
        <MetricField
          label={metric_1}
          value={config.metric1}
          onChange={(value) => onChange("metric1", value)}
          exercise={exercise}
          disabled={disabled}
        />
        <MetricField
          label={metric_2 ?? "Métrica 2"}
          value={config.metric2}
          type={config.metric2Type}
          onChange={(value) => onChange("metric2", value)}
          onTypeChange={(value) => onChange("metric2Type", value)}
          optional={!exercise.metric_2}
          exercise={exercise}
          disabled={disabled}
        />
        <MetricField
          label="PSE"
          value={config.pse}
          onChange={(value) => onChange("pse", value)}
          optional
          exercise={exercise}
          disabled={disabled}
        />
        <RestDurationField
          value={config.rest}
          onChange={(seconds) => onChange("rest", seconds)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MetricField({
  className,
  label,
  value,
  type,
  onChange,
  onTypeChange,
  optional = false,
  exercise,
  disabled = false,
}: {
  label?: string;
  value: string;
  type?: RegisterType;
  onChange: (value: string) => void;
  onTypeChange?: (value: RegisterType) => void;
  optional?: boolean;
  className?: string;
  exercise: Exercise;
  disabled?: boolean;
}) {
  if (!label) return null;

  const metric_2 =
    (exercise?.metric_2 && metricUnits[exercise?.metric_2]) || null;
  const hasButtonMetric2 = !!onTypeChange && metric_2;

  return (
    <div className="block text-[11px] font-semibold leading-none text-on-surface-variant">
      {label}
      {optional ? " (opcional)" : ""}
      <div className="mt-1 flex h-8">
        <Input
          aria-label={label}
          sizeVariant="sm"
          type="number"
          min={label === "PSE" ? 1 : undefined}
          max={label === "PSE" ? 10 : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          sideComponent={hasButtonMetric2 ? "right" : "none"}
        />
        {hasButtonMetric2 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTypeChange(type === "p" ? "v" : "p")}
            className="h-[30px] w-auto px-1 rounded-r-lg border border-l-0 border-outline-variant bg-surface-container-highest text-xs font-bold text-primary-fixed-dim"
            aria-label={`Alternar unidade entre porcentagem e valor, atual ${type}`}
          >
            {type === "p" ? "%" : metric_2}
          </button>
        )}
      </div>
    </div>
  );
}

function RestDurationField({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="block text-[11px] font-semibold leading-none text-on-surface-variant">
      Descanso
      <div className="mt-1 flex h-8">
        <Input
          aria-label="Duração do descanso"
          sizeVariant="sm"
          type="time"
          step={2}
          value={secondsToTime(value)}
          onChange={(event) => onChange(timeToSeconds(event.target.value))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  maxLength,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      label={label}
      sizeVariant="sm"
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      hint={`${value.length}/${maxLength}`}
    />
  );
}

function ExercisePicker({
  selected,
  onToggle,
  onClose,
}: {
  selected: Exercise[];
  onToggle: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl rounded-lg border border-outline-variant bg-surface-container p-6">
        <div className="mb-5 flex justify-between">
          <div>
            <p className="type-label-caps text-primary-fixed-dim">
              Seleção de exercícios
            </p>
            <h2 className="mt-2 text-xl font-bold">Escolha a sequência</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-on-surface-variant hover:text-primary"
          >
            <RiCloseLine size={24} />
          </button>
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {exercises.map((exercise) => {
            const order =
              selected.findIndex((item) => item.id === exercise.id) + 1;
            return (
              <button
                key={exercise.id}
                onClick={() => onToggle(exercise)}
                className={`relative flex w-full items-center gap-4 rounded border p-3 text-left transition ${order ? "border-primary-fixed-dim bg-surface-container-high" : "border-outline-variant bg-surface-container-low hover:bg-surface-container-high"}`}
              >
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
                  <RiHeartPulseLine size={28} />
                  {order > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/70 text-xl font-bold text-primary-fixed-dim">
                      {order}
                    </span>
                  )}
                </span>
                <span className="font-semibold">{exercise.name}</span>
                {order > 0 && (
                  <span className="ml-auto text-primary-fixed-dim">
                    <RiCheckLine size={22} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end border-t border-outline-variant pt-5">
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </div>
  );
}
