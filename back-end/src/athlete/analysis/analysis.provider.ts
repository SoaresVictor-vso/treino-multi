import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  athleteAnalysisQuery,
  exerciseAnalysisQuery,
} from './sql/analysis-query.sql';
import type {
  IndicatorRow,
  MeasurementRow,
  LifetimeRow,
  ExerciseRow,
  ExerciseLifetimeRow,
} from './analysis.mapper';

export interface AnalysisAccessRow {
  found: boolean;
  allowed: boolean;
  name: string | null;
}
export interface AthleteAnalysisRow extends AnalysisAccessRow {
  measurements: MeasurementRow[];
  lifetime: LifetimeRow[];
  exercises: ExerciseRow[];
}
export interface ExerciseAnalysisRow extends AnalysisAccessRow {
  indicators: IndicatorRow[];
  lifetime: ExerciseLifetimeRow[];
}

@Injectable()
export class AnalysisProvider {
  constructor(private readonly dataSource: DataSource) {}

  async athlete(athleteId: string, actorId: string, days: number) {
    const [row] = await this.dataSource.query<AthleteAnalysisRow[]>(
      athleteAnalysisQuery, [athleteId, actorId, days],
    );
    return row;
  }

  async exercise(
    athleteId: string,
    actorId: string,
    period: '7' | '15' | '30' | '3m',
    exerciseId: number,
    from: string,
    to: string,
  ) {
    const threeMonths = period === '3m';
    const params = threeMonths
      ? [athleteId, actorId, from, to, exerciseId]
      : [athleteId, actorId, Number(period), exerciseId];
    const [row] = await this.dataSource.query<ExerciseAnalysisRow[]>(
      exerciseAnalysisQuery(threeMonths), params,
    );
    return row;
  }
}
