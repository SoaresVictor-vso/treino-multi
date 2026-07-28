import type { Activity, Exercise } from "@/app/(authenticated)/workout-template/types";

export type Template = {
  id: number;
  title: string;
  description: string;
  exercises: Exercise[];
  activities: Activity[];
};

export type TemplateModalState = {
  mode: "view" | "edit";
  template: Template;
};
