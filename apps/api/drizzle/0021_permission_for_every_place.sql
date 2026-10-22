-- Every place that visitors can open needs the site's permission, with a stamp or without. Until now a place with its
-- stamp switched off could be public without it. Those places go back to drafts here (the constraint below would refuse
-- them otherwise); each comes back as soon as an admin ticks "permission confirmed" and publishes it again.
UPDATE "spots" SET "published" = false WHERE "published" AND NOT "permission_confirmed";--> statement-breakpoint
ALTER TABLE "spots" DROP CONSTRAINT "spots_publish_requires_permission";--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_publish_requires_permission" CHECK (not "spots"."published" or "spots"."permission_confirmed");
