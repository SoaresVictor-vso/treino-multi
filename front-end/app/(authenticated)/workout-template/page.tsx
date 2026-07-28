"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import {
  RiAddLine,
  RiArrowRightSLine,
  RiHeartPulseLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from "react-icons/ri";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import { exercises, metricLabels, metricUnits } from "./mocks";
import type { CreateWorkoutTemplateDto, Exercise } from "./types";

type Template = {
  id: number;
  title: string;
  description: string;
  exercises: Exercise[];
};
type RegisterType = "p" | "v";
type ExerciseConfig = {
  metric1: string;
  metric2: string;
  pse: string;
  metric2Type: RegisterType;
};

const initialTemplates: Template[] = [
  {
    id: 1,
    title: "Força · Membros inferiores",
    description:
      "Base de força para membros inferiores com foco em controle e progressão.",
    exercises: [exercises[0], exercises[2]],
  },
  {
    id: 2,
    title: "Condicionamento · HIIT",
    description:
      "Circuito intervalado para elevar a capacidade cardiovascular.",
    exercises: [exercises[3]],
  },
];

export default function WorkoutTemplatePage() {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selected, setSelected] = useState(initialTemplates[0]);
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
      exercises: workoutTemplate.activities.reduce<Exercise[]>(
        (items, activity) => {
          const exercise = exercises.find((item) => item.id === activity.exercise);
          return exercise && !items.some((item) => item.id === exercise.id)
            ? [...items, exercise]
            : items;
        },
        [],
      ),
    };
    setTemplates((current) => [...current, saved]);
    setSelected(saved);
    setCreateOpen(false);
  };

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
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Templates ativas" value={templates.length} />
        <Stat
          label="Exercícios cadastrados"
          value={templates.reduce(
            (total, item) => total + item.exercises.length,
            0,
          )}
        />
        <Stat label="Última atualização" value="Hoje" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="type-headline-md">
              Todas as templates{" "}
              <span className="ml-2 text-sm font-normal text-on-surface-variant">
                {filtered.length}
              </span>
            </h2>
            <label className="flex items-center gap-2 border-b border-outline bg-surface-container px-3 py-2 text-sm focus-within:border-primary-container">
              <span className="text-on-surface-variant">
                <RiSearchLine />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar template"
                className="w-full bg-transparent outline-none placeholder:text-on-surface-variant"
              />
            </label>
          </div>
          <div className="space-y-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`flex w-full items-center justify-between gap-4 rounded border p-4 text-left transition ${selected.id === item.id ? "border-primary-fixed-dim bg-surface-container-high" : "border-transparent hover:bg-surface-container-high"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="truncate font-bold">{item.title}</span>
                    <span className="shrink-0 rounded-sm bg-primary-fixed-dim/15 px-2 py-1 font-mono text-xs text-primary-fixed-dim">
                      {item.exercises.length} exercícios
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm text-on-surface-variant">
                    {item.description}
                  </p>
                </div>
                <span className="shrink-0 text-primary-fixed-dim">
                  <RiArrowRightSLine size={24} />
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-8 text-center text-on-surface-variant">
                Nenhuma template encontrada.
              </p>
            )}
          </div>
        </section>
        <aside className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
          <p className="type-label-caps text-primary-fixed-dim">
            Prévia da template
          </p>
          <h2 className="mt-2 text-xl font-bold">{selected.title}</h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {selected.description}
          </p>
          <h3 className="type-label-caps mb-3 mt-6 text-on-surface-variant">
            Sequência
          </h3>
          <div className="space-y-2">
            {selected.exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className="flex items-center gap-3 rounded border border-outline-variant bg-surface-container p-3"
              >
                <span className="font-mono text-primary-fixed-dim">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-on-surface-variant">
                  <RiHeartPulseLine />
                </span>
                <span className="text-sm font-semibold">{exercise.name}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onSave={saveTemplate}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
      <p className="type-label-caps text-on-surface-variant">{label}</p>
      <p className="mt-2 text-2xl font-bold text-primary-fixed-dim">{value}</p>
    </div>
  );
}

function CreateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (workoutTemplate: CreateWorkoutTemplateDto) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [configs, setConfigs] = useState<Record<number, ExerciseConfig[]>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const newConfig = (): ExerciseConfig => ({
    metric1: "",
    metric2: "",
    pse: "",
    metric2Type: "p",
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
    value: string,
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
              Nova template
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Cadastrar template de treino
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
        <div className="space-y-4">
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
        </div>
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <h3 className="type-headline-md">
              Exercícios{" "}
              <span className="ml-2 text-sm font-normal text-on-surface-variant">
                {selected.length}
              </span>
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <RiAddLine /> Adicionar exercício
            </Button>
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
                        onChange={(key, value) =>
                          updateConfig(item.id, configIndex, key, value)
                        }
                      />
                    ),
                  )}
                </div>
                <button
                  type="button"
                  data-add-block
                  onClick={() => addConfig(item.id)}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-fixed-dim hover:text-primary"
                >
                  <RiAddLine /> Adicionar outro bloco
                </button>
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
            Cancelar
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={createWorkoutTemplate}
          >
            Criar template
          </Button>
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
  onChange,
}: {
  exercise: Exercise;
  index: number;
  config: ExerciseConfig;
  onChange: (key: keyof ExerciseConfig, value: string) => void;
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
      <div className="grid items-end gap-2 grid-cols-10">
        <div className="flex items-center justify-center my-auto">
          <Badge label={`${index + 1}`} type="primary" />
        </div>
        <MetricField
          label={metric_1}
          value={config.metric1}
          onChange={(value) => onChange("metric1", value)}
          className="col-span-3"
          exercise={exercise}
        />
        <MetricField
          label={metric_2 ?? "Métrica 2"}
          value={config.metric2}
          type={config.metric2Type}
          onChange={(value) => onChange("metric2", value)}
          onTypeChange={(value) => onChange("metric2Type", value)}
          optional={!exercise.metric_2}
          className="col-span-3"
          exercise={exercise}
        />
        <MetricField
          label="PSE"
          value={config.pse}
          onChange={(value) => onChange("pse", value)}
          optional
          className="col-span-3"
          exercise={exercise}
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
}: {
  label?: string;
  value: string;
  type?: RegisterType;
  onChange: (value: string) => void;
  onTypeChange?: (value: RegisterType) => void;
  optional?: boolean;
  className?: string;
  exercise: Exercise;
}) {
  if (!label) return null;

  const metric_2 =
    (exercise?.metric_2 && metricUnits[exercise?.metric_2]) || null;
  const hasButtonMetric2 = !!onTypeChange && metric_2;

  return (
    <div
      className={`block text-[11px] font-semibold leading-none text-on-surface-variant ${className ?? ""}`}
    >
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
          sideComponent={hasButtonMetric2 ? "right" : "none"}
        />
        {hasButtonMetric2 && (
          <button
            type="button"
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
