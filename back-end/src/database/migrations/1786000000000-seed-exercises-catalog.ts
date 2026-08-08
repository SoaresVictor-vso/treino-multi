import { MigrationInterface, QueryRunner } from 'typeorm';

const EXERCISES = [
	'Supino inclinado com barra',
	'Supino declinado com barra',
	'Supino Spotto Press',
	'Supino com pausa',
	'Supino touch and go',
	'Supino Floor Press',
	'Supino Board Press',
	'Supino Paralímpico (Larsen Press)',
	'Supino com halteres',
	'Supino Inclinado com Halteres',
	'Agachamento com Pausa',
	'Agachamento Tempo',
	'Agachamento Frontal',
	'Agachamento Zercher',
	'Agachamento com Salto',
	'Agachamento Complex',
	'Agachamento Caixa (Box)',
	'Agachamento Safe Squat Bar',
	'Agachamento Búlgaro',
	'Afundo',
	'Avanço',
	'Cadeira extensora',
	'Cadeira extensora unilateral',
	'Cadeira Abdutora',
	'Cadeira Adutora',
	'Leg Press 45º Carrinho',
	'Leg Press 45º Carrinho Unilateral',
	'Leg Press 45º Pêndulo',
	'Leg Press 45º Pêndulo Unilateral',
	'Leg press 90º Carrinho',
	'Leg press 90º Carrinho Unilateral',
	'Remada baixa polia neutra',
	'Remada baixa polia supinada',
	'Remada baixa polia pronada',
	'Puxada alta neutra',
	'Puxada alta supinada',
	'Puxada alta pronada',
	'Rosca Martelo Unilateral com Halteres',
	'Rosca Martelo Bileteral com Halteres',
	'Rosca Direta Unilateral com Halteres',
	'Rosca Direta Bileteral com Halteres',
	'Rosca Direta com Barra',
	'Rosca Martelo Barra H',
	'Rosca Inclinada Unilateral com halteres',
	'Rosca Inclinada Bilateral com halteres',
	'Rosca Scott com halteres',
	'Rosca Scott com barra',
	'Desenvolvimento barra (Military press)',
	'Desenvlvimento com halteres',
	'Desenvlvimento sentado com halteres',
	'Elevação Frontal com halteres',
	'Elevação Frontal com barra',
	'Elevação Lateral com halteres',
	'Curcifixo máquina',
	'Crucifixo Halteres',
	'Crucifixo inclinado com Hateres',
	'Crucifixo reverso máquina',
	'Crucifixo reverso com halteres',
	'Elevação pélvica barra',
	'Elevação pélvica máquina',
	'Levantamento Terra Convencional',
	'Levantamento Terra Sumô',
	'Levantamento Terra em Bloco',
	'Levantamento Terra em Déficit',
	'Levantamento Terra Pausa saída',
	'Levantamento Terra Pausa Joelho',
	'Levantamento Terra Romeno',
	'Stiff (Levantamento Terra Stiff)',
	'Levantamento Terra Zercher',
	'Levantamento Terra Barra Hexagonal',
] as const;

const GROUP_EXERCISES: Record<string, string[]> = {
	Supino: [
		'Supino Reto com Barra',
		'Supino inclinado com barra',
		'Supino declinado com barra',
		'Supino Spotto Press',
		'Supino com pausa',
		'Supino touch and go',
		'Supino Floor Press',
		'Supino Board Press',
		'Supino Paralímpico (Larsen Press)',
	],
	Agachamento: [
		'Agachamento Livre',
		'Agachamento com Pausa',
		'Agachamento Tempo',
		'Agachamento Frontal',
		'Agachamento Zercher',
		'Agachamento com Salto',
		'Agachamento Complex',
		'Agachamento Caixa (Box)',
		'Agachamento Safe Squat Bar',
	],
	'Levantamento Terra': [
		'Levantamento Terra Convencional',
		'Levantamento Terra Sumô',
		'Levantamento Terra em Bloco',
		'Levantamento Terra em Déficit',
		'Levantamento Terra Pausa saída',
		'Levantamento Terra Pausa Joelho',
		'Levantamento Terra Romeno',
		'Stiff (Levantamento Terra Stiff)',
		'Levantamento Terra Zercher',
		'Levantamento Terra Barra Hexagonal',
	],
};

function descriptionFor(name: string): string {
	const normalized = name.toLocaleLowerCase();
	if (
		normalized.startsWith('levantamento terra') ||
		normalized.includes('levantamento terra stiff')
	)
		return 'deadlift';
	if (normalized.startsWith('supino')) return 'bench press';
	if (normalized.startsWith('agachamento')) return 'squat';
	if (
		normalized.startsWith('desenvolvimento') ||
		normalized.startsWith('desenvlvimento')
	)
		return 'military press';
	return '';
}

export class SeedExercisesCatalog1786000000000 implements MigrationInterface {
	name = 'SeedExercisesCatalog1786000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "exercises"
			 SET "name" = 'Levantamento Terra Convencional'
			 WHERE lower("name") = 'levantamento terra'`,
		);
		await queryRunner.query(
			`UPDATE "exercises"
			 SET "name" = 'Supino Reto com Barra'
			 WHERE lower("name") = 'supino'`,
		);

		await queryRunner.query(
			`INSERT INTO "exercises" ("name", "description", "tenant_id", "metric_1_id", "metric_2_id", "visual_url")
			 SELECT seed."name", seed."description", NULL, repetitions."id", weight."id", NULL
			 FROM unnest($1::varchar[], $2::text[]) AS seed("name", "description")
			 CROSS JOIN "metrics" repetitions
			 CROSS JOIN "metrics" weight
			 WHERE repetitions."symbol" = 'reps' AND weight."symbol" = 'kg'
			 AND NOT EXISTS (
				SELECT 1 FROM "exercises" exercise
				WHERE lower(exercise."name") = lower(seed."name") AND exercise."deleted_at" IS NULL
			 )`,
			[EXERCISES, EXERCISES.map(descriptionFor)],
		);

		await queryRunner.query(
			`UPDATE "exercises"
			 SET "description" = CASE
				WHEN lower("name") LIKE 'levantamento terra%' OR lower("name") LIKE '%levantamento terra stiff%' THEN 'deadlift'
				WHEN lower("name") LIKE 'supino%' THEN 'bench press'
				WHEN lower("name") LIKE 'agachamento%' THEN 'squat'
				WHEN lower("name") LIKE 'desenvolvimento%' OR lower("name") LIKE 'desenvlvimento%' THEN 'military press'
				ELSE "description"
			 END`,
		);

		const groupNames = Object.keys(GROUP_EXERCISES);
		await queryRunner.query(
			`INSERT INTO "exercise_groups" ("name", "tenant_id", "metric_1_id", "metric_2_id", "created_by", "updated_by", "deleted_by")
			 SELECT seed."name", tenant."id", repetitions."id", weight."id", actor."id", actor."id", NULL
			 FROM unnest($1::varchar[]) AS seed("name")
			 CROSS JOIN "tenants" tenant
			 CROSS JOIN "metrics" repetitions
			 CROSS JOIN "metrics" weight
			 JOIN LATERAL (
				SELECT "id" FROM "users"
				WHERE "deleted_at" IS NULL AND ("tenant_id" = tenant."id" OR "tenant_id" IS NULL)
				ORDER BY CASE WHEN "tenant_id" = tenant."id" THEN 0 ELSE 1 END, "created_at"
				LIMIT 1
			) actor ON true
			 WHERE repetitions."symbol" = 'reps' AND weight."symbol" = 'kg'
			 AND NOT EXISTS (
				SELECT 1 FROM "exercise_groups" group_item
				WHERE group_item."tenant_id" = tenant."id"
				AND lower(group_item."name") = lower(seed."name")
				AND group_item."deleted_at" IS NULL
			 )`,
			[groupNames],
		);

		const mappings = Object.entries(GROUP_EXERCISES).flatMap(
			([groupName, exerciseNames]) =>
				exerciseNames.map((exerciseName) => ({ groupName, exerciseName })),
		);
		await queryRunner.query(
			`INSERT INTO "exercise_group_exercises" ("exercise_group_id", "exercise_id", "created_by", "deleted_by")
			 SELECT group_item."id", exercise."id", group_item."created_by", NULL
			 FROM unnest($1::varchar[], $2::varchar[]) AS mapping("group_name", "exercise_name")
			 JOIN "exercise_groups" group_item ON lower(group_item."name") = lower(mapping."group_name")
			 JOIN "exercises" exercise ON lower(exercise."name") = lower(mapping."exercise_name")
			 JOIN "metrics" repetitions ON repetitions."id" = group_item."metric_1_id" AND repetitions."symbol" = 'reps'
			 JOIN "metrics" weight ON weight."id" = group_item."metric_2_id" AND weight."symbol" = 'kg'
			 WHERE group_item."deleted_at" IS NULL AND exercise."deleted_at" IS NULL
			 AND NOT EXISTS (
				SELECT 1 FROM "exercise_group_exercises" membership
				WHERE membership."exercise_group_id" = group_item."id"
				AND membership."exercise_id" = exercise."id"
				AND membership."deleted_at" IS NULL
			 )`,
			[
				mappings.map(({ groupName }) => groupName),
				mappings.map(({ exerciseName }) => exerciseName),
			],
		);
		await queryRunner.query(`UPDATE "exercises" SET "name" = upper("name")`);

		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exercises_name_active"
			 ON "exercises" (lower("name"))
			 WHERE "deleted_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_exercise_groups_tenant_name_active"
			 ON "exercise_groups" ("tenant_id", lower("name"))
			 WHERE "deleted_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_workout_templates_tenant_name_active"
			 ON "workout_templates" ("tenant_id", lower("name"))
			 WHERE "deleted_at" IS NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX "UQ_workout_templates_tenant_name_active"`,
		);
		await queryRunner.query(`DROP INDEX "UQ_exercise_groups_tenant_name_active"`);
		await queryRunner.query(`DROP INDEX "UQ_exercises_name_active"`);
		const groupNames = Object.keys(GROUP_EXERCISES);
		await queryRunner.query(
			`DELETE FROM "exercise_group_exercises"
			 WHERE "exercise_group_id" IN (
				SELECT "id" FROM "exercise_groups" WHERE "name" = ANY($1::varchar[])
			 )`,
			[groupNames],
		);
		await queryRunner.query(
			`DELETE FROM "exercise_groups" WHERE "name" = ANY($1::varchar[])`,
			[groupNames],
		);
		await queryRunner.query(
			`DELETE FROM "exercises" WHERE "name" = ANY($1::varchar[])`,
			[EXERCISES.filter((name) => name !== 'Levantamento Terra Convencional')],
		);
		await queryRunner.query(
			`UPDATE "exercises" SET "name" = 'LEVANTAMENTO TERRA', "description" = ''
			 WHERE "name" = 'Levantamento Terra Convencional'`,
		);
		await queryRunner.query(
			`UPDATE "exercises" SET "name" = 'SUPINO', "description" = ''
			 WHERE "name" = 'Supino Reto com Barra'`,
		);
	}
}
