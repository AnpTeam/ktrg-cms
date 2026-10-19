CREATE TABLE "course_completions" (
	"user_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_completions_user_id_route_id_pk" PRIMARY KEY("user_id","route_id")
);
--> statement-breakpoint
CREATE TABLE "rally_completions" (
	"user_id" uuid NOT NULL,
	"rally_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rally_completions_user_id_rally_id_pk" PRIMARY KEY("user_id","rally_id")
);
--> statement-breakpoint
CREATE TABLE "rally_routes" (
	"rally_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rally_routes_rally_id_route_id_pk" PRIMARY KEY("rally_id","route_id")
);
--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rally_completions" ADD CONSTRAINT "rally_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rally_completions" ADD CONSTRAINT "rally_completions_rally_id_rallies_id_fk" FOREIGN KEY ("rally_id") REFERENCES "public"."rallies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rally_routes" ADD CONSTRAINT "rally_routes_rally_id_rallies_id_fk" FOREIGN KEY ("rally_id") REFERENCES "public"."rallies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rally_routes" ADD CONSTRAINT "rally_routes_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_completions_route_idx" ON "course_completions" USING btree ("route_id");--> statement-breakpoint
CREATE INDEX "rally_completions_rally_idx" ON "rally_completions" USING btree ("rally_id");--> statement-breakpoint
CREATE INDEX "rally_routes_route_idx" ON "rally_routes" USING btree ("route_id");--> statement-breakpoint
-- Data, while the old columns still exist (0012 drops them). A rally of courses now lists courses, not places:
-- each existing course rally keeps its one course, and its place links go (a course's places are its route's).
INSERT INTO "rally_routes" ("rally_id", "route_id", "position")
  SELECT "id", "route_id", 1 FROM "rallies" WHERE "kind" = 'course' AND "route_id" IS NOT NULL;--> statement-breakpoint
DELETE FROM "rally_spots" WHERE "rally_id" IN (SELECT "id" FROM "rallies" WHERE "kind" = 'course');--> statement-breakpoint
-- Every existing rally was already visible to visitors.
UPDATE "rallies" SET "published" = true;
