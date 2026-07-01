import { MigrationInterface, QueryRunner } from "typeorm";

export class Initializing1777333116218 implements MigrationInterface {
    name = 'Initializing1777333116218'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "trade_name" character varying NOT NULL, "registered_name" character varying, "slug" character varying NOT NULL, "cnpj" character(14), "phone" character varying, "email" character varying, "is_active" boolean NOT NULL DEFAULT true, "deleted_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role" character varying NOT NULL, "assigned_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_09d115a69b6014d324d592f9c42" PRIMARY KEY ("user_id", "role"))`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip_address" character varying, "user_agent" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "person_id" uuid NOT NULL, "tenant_id" uuid, "context" character varying NOT NULL, "password_hash" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_0eeba11684d680054f8b58097e" CHECK ("context" IN ('organization','tenant','standalone')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "persons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "document" character(11) NOT NULL, "phone" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_928155276ca8852f3c440cc2b2c" UNIQUE ("email"), CONSTRAINT "UQ_b791f0a870dff271a6a78392b4f" UNIQUE ("document"), CONSTRAINT "PK_74278d8812a049233ce41440ac7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_user_id" uuid, "actor_context" character varying NOT NULL, "person_id" uuid, "tenant_id" uuid, "action" character varying NOT NULL, "route" character varying, "http_method" character varying, "request_body" jsonb, "request_query" jsonb, "ip_address" character varying, "user_agent" character varying, "status_code" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "log_context_types" ("id" smallint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_3609bc07724b8bb42d606c85a84" UNIQUE ("name"), CONSTRAINT "PK_3f510698cfb406217813fe64ff1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "log_context_types" ("id", "name") VALUES (1, 'organization'), (2, 'tenant'), (3, 'standalone')`);
        await queryRunner.query(`CREATE TABLE "authentication_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "context_type_id" smallint NOT NULL, "success" boolean NOT NULL, "login_used" character varying NOT NULL, "ip_address" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8f22c91bd5ae5f1f651f9ca5a1c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "critical_operation_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "table_name" character varying NOT NULL, "operation" character varying NOT NULL, "record_id" character varying NOT NULL, "diff" jsonb, "user_id" uuid, "ip_address" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_67c5d17cf82a5ffb4a19328e625" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "password_change_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid, "user_id" uuid NOT NULL, "is_session" boolean NOT NULL, "ip_address" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6847e0a3d9a410c864ab4ec196b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_5ed72dcd00d6e5a88c6a6ba3d18" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_f160d97a931844109de9d04228f" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "authentication_logs" ADD CONSTRAINT "FK_8ced238bdc15b8bf4e99357e0e7" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "authentication_logs" ADD CONSTRAINT "FK_493d8572812d5e81a7a70438fb5" FOREIGN KEY ("context_type_id") REFERENCES "log_context_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "critical_operation_logs" ADD CONSTRAINT "FK_6cf1190bcf81d553399fa85dacc" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "critical_operation_logs" ADD CONSTRAINT "FK_9edd5e1ce4dc088151e14e11575" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_change_logs" ADD CONSTRAINT "FK_9afdc8e6564e1d43858acd0df07" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_change_logs" ADD CONSTRAINT "FK_42090dbd3b81794e58eb667cd40" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_change_logs" DROP CONSTRAINT "FK_42090dbd3b81794e58eb667cd40"`);
        await queryRunner.query(`ALTER TABLE "password_change_logs" DROP CONSTRAINT "FK_9afdc8e6564e1d43858acd0df07"`);
        await queryRunner.query(`ALTER TABLE "critical_operation_logs" DROP CONSTRAINT "FK_9edd5e1ce4dc088151e14e11575"`);
        await queryRunner.query(`ALTER TABLE "critical_operation_logs" DROP CONSTRAINT "FK_6cf1190bcf81d553399fa85dacc"`);
        await queryRunner.query(`ALTER TABLE "authentication_logs" DROP CONSTRAINT "FK_493d8572812d5e81a7a70438fb5"`);
        await queryRunner.query(`ALTER TABLE "authentication_logs" DROP CONSTRAINT "FK_8ced238bdc15b8bf4e99357e0e7"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_f160d97a931844109de9d04228f"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_5ed72dcd00d6e5a88c6a6ba3d18"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`DROP TABLE "password_change_logs"`);
        await queryRunner.query(`DROP TABLE "critical_operation_logs"`);
        await queryRunner.query(`DROP TABLE "authentication_logs"`);
        await queryRunner.query(`DELETE FROM "log_context_types"`);
        await queryRunner.query(`DROP TABLE "log_context_types"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TABLE "persons"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
    }

}
