import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."subscriptions_source_enum" AS ENUM(
        'rss', 'twitter', 'github', 'hacker_news', 'reddit', 'newsletter'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."subscriptions_frequency_enum" AS ENUM(
        'daily', 'weekly', 'realtime'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "source" "public"."subscriptions_source_enum" NOT NULL,
        "sourceUrl" character varying NOT NULL,
        "frequency" "public"."subscriptions_frequency_enum" NOT NULL DEFAULT 'daily',
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "n8nWorkflowId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."digests_status_enum" AS ENUM(
        'pending', 'processing', 'completed', 'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "digests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subscriptionId" uuid NOT NULL,
        "status" "public"."digests_status_enum" NOT NULL DEFAULT 'pending',
        "content" text,
        "summary" text,
        "rawItems" jsonb,
        "n8nExecutionId" character varying,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_digests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_digests_subscriptions" FOREIGN KEY ("subscriptionId")
          REFERENCES "subscriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "digests"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."digests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_source_enum"`);
  }
}
