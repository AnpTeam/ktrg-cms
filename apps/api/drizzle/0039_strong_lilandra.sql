ALTER TABLE "blog_comments" DROP CONSTRAINT "blog_comments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;