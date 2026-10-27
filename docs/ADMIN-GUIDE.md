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

Shops, rest areas, toilets, vending machines and so on. Each place can name a nearby route and a nearby waypoint. A place needs a checked position and its listing permission ticked before it can be published. **Opening hours** are a table: one row per day with a "closed" tick and time pickers; **+ Add hours** gives a day a second period (a lunch break). Visitors see the Japanese and English text built from the table, and the weekly closed days from the ticked rows; holidays and other special cases go in the note. The older text fields (labelled "older text") are shown to visitors only while the table is empty. Use **Import from a sheet (CSV)** for the field team's sheet: it shows the counts first, adds places as drafts, and skips places already there. The sheet's nearby-stop name (近いスタンプ場所) is linked to the waypoint of that exact name on the same route; if the name matches none or several, the field stays empty and you pick it by hand. **Find duplicates** lists places that look entered twice; keep the most complete one and delete the others.

## Notices (closures and hazards)

Enter the title and text in both languages, the **source link**, the **date you checked it** and an **end date**. Visitors see how many days ago it was checked, the link, and "check official sources before you go". Do not copy a notice from a page you have not read.

## Blog

Posts can link to a route, a waypoint, a mound or a place. "Written by" is you by default; pick a writer from the Writers list to post under another name. Comments from visitors wait in the Comments screen until you approve them (staff comments go live at once).

## Pages

Pages has the built-in texts (privacy policy, terms and so on). The **how to play** text (遊び方) is also what new visitors read in the welcome screen, as plain words: its steps are shown there in order, **except the last one** (sign up), which waits until the visitor opens the rallies page. Keep "sign up" as the last step and **New page** for your own, shown at `/p/<address>` once published. The address cannot be reused.

## Where visits come from

**Where visits come from** (アクセスの地域, in the menu; editors and admins) counts page views by the approximate region of the connection: country, prefecture (in Japan) and city. Pick the days, and optionally a page to look at (type `/routes`, `/rallies` or `/` for the landing page). Cities with fewer than 5 views are not named, only counted in the total. The count has no IP address and no person in it, and visitors who turn on Do Not Track or Global Privacy Control are counted with no place (they show as Unknown). City-level places can be wrong (mobile networks route through other cities), so read prefecture and country as reliable and city as a rough guide. It does not show where visitors live, only where their connection appears to come from.

## Stamps

Stamps are only ever given by the server. A flagged stamp (weak GPS, or impossible travel) is a hint, not a ban: look at it and **revoke** if it is not real. Revoking also removes any course or rally finish that stamp earned.

## Users and the audit log (admin only)

Changing a role asks you to sign in again first. Open an account to **restrict** it (it can still sign in and look, but cannot collect stamps or write comments; give a reason and, if you like, an end day) or to **delete** it. Deleting is by default **in 3 days** (until then it can be cancelled); **delete now** is for test accounts and asks you to type the member ID. All of these ask you to sign in again first, are refused for your own account and for other admins (change the role first), and are written to the audit log by account number only. The restriction reason is visible to admins only. The audit log lists who changed what, by id; it never holds emails.
