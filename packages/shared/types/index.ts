export type PredictedRmExecution = {
	metric1Name?: string | null;
	metric2Name?: string | null;
	metric1: number | null;
	metric2: number | null;
	completed: boolean;
};

export type FormulaContext = Record<string, number | boolean | null | undefined>;
export type ZeroState = Record<string, number>;

export type MeasurementPresentation = {
	containerClass: string;
	iconClass: string;
	valueClass: string;
	labelClass: string;
};

export type MeasurementDefinition = {
	key: string;
	name: string;
	metric1Name: string | null;
	metric2Name: string | null;
	formula: string;
	valueFormula: string;
	staticWeight: number;
	dynamicWeight: number;
	icon: string;
	unit: string | null;
	aggregation: 'sum' | 'average';
	presentation: MeasurementPresentation;
};

export type UserContext = 'organization' | 'tenant' | 'standalone';
export type TenantFunction = 'admin' | 'trainer' | 'trainer-master' | 'client';
