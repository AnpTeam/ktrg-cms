# Admin guide

For editors and admins. Open `/admin` after signing in with an account that has the editor or admin role. An admin gives the role (Users screen).

The menu has sections; "Back" and "Hide menu" are at the top of the left column. On a page being edited, "Go to public site" opens the visitor's version.

## Saving

- Every edit screen has a bar at the bottom: **Save**, and **Save and next** on lists. Ctrl+S saves too.
- If someone else saved the same item first you see a conflict message: reload and redo your change.
- Leaving with unsaved changes asks first, including the browser's back button.
- Everything is written in Japanese and English side by side. Japanese is required; a missing English text falls back to Japanese and is marked.

## Routes and waypoints

- A route has five tabs. Each **waypoint** has a kind and a switch for "can be stamped".
- Positions are never guessed. Take them from a named source (for example the official Japan Heritage site), check them on the map, then tick "position checked" and write the source.
- A route line is hidden from visitors until "line checked" is ticked.
- A draft stays hidden until you **publish** it (公開する). **Stop publishing** (公開をやめる) returns it to a draft.
- A route with no published waypoints still shows in the list as 準備中.
- The video link has an **Earlier video links** list under it: replaced or removed links are kept, and "Put this link back" fills the field again (save as usual).
- A route that has a checked line shows a **GPX download** to signed-in visitors.
- Every rally has its own page at `/rallies/<id>`: photo, progress, the stamps to unlock, the places in order, and buttons to bookmark it, start (opens the next place on the map) and stamp the place the visitor is standing at. Nothing to enter: it is built from the rally and its places.

## Places (the directory)

Shops, rest areas, toilets, vending machines and so on. A place needs a checked position and its listing permission ticked before it can be published. Use **Import from a sheet (CSV)** for the field team's sheet: it shows the counts first, adds places as drafts, and skips places already there. **Find duplicates** lists places that look entered twice; keep the most complete one and delete the others.

## Notices (closures and hazards)

Enter the title and text in both languages, the **source link**, the **date you checked it** and an **end date**. Visitors see how many days ago it was checked, the link, and "check official sources before you go". Do not copy a notice from a page you have not read.

## Blog

Posts can link to a route, a waypoint, a mound or a place. "Written by" is you by default; pick a writer from the Writers list to post under another name. Comments from visitors wait in the Comments screen until you approve them (staff comments go live at once).

## Pages

Pages has the built-in texts (privacy policy, terms and so on) and **New page** for your own, shown at `/p/<address>` once published. The address cannot be reused.

## Stamps

Stamps are only ever given by the server. A flagged stamp (weak GPS, or impossible travel) is a hint, not a ban: look at it and **revoke** if it is not real. Revoking also removes any course or rally finish that stamp earned.

## Users and the audit log (admin only)

Changing a role asks you to sign in again first. The audit log lists who changed what, by id; it never holds emails.
