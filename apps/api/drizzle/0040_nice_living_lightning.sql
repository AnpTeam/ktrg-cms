CREATE TABLE "route_video_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"video_url" text NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_video_history" ADD CONSTRAINT "route_video_history_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_video_history_route_idx" ON "route_video_history" USING btree ("route_id","replaced_at");
--> statement-breakpoint
ALTER TABLE "route_video_history" ENABLE ROW LEVEL SECURITY;