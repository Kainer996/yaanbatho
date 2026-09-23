# Seated quest revisits — v457

Build: `quest-revisit-v457-20260923`.

- Reopen genuinely discovered walking encounters, destination stops and wayside buildings while away; collect previously passed Side Quest finds once and reread saved lore.
- Explore map pans without moving the player; Centre on me returns to real GPS.
- Preserve initial accurate/fresh GPS discovery, coordinate-bound receipts, canonical rewards and saves. Planned stops and old ungated receipts are not discovery. Finish my walk retains its separate honor-based review.
- Retain expedition duration slider PR394 and its v455 Academy core pin; unchanged styles and all other module pins remain unchanged.

Discovery repair: install legacy-normalized state inside the rollback transaction and resolve the installed quest before saving. Gate and observation share the same entry-ID/coordinates/finite-positive-timestamp receipt validity test; only a new fresh accurate GPS arrival can replace an invalid receipt. No reward or honor-review behavior changes.

Current local verification and exact repaired candidate hashes: `/root/.hermes/task-progress/tonight-release-20260923/QUEST_REPAIR.md`; this supersedes the original `QUEST_RELEASE.md` candidate/evidence. The unpublished v457 pins remain unchanged; only the destination core runtime bytes change in this repair. Independent specification then quality review and public verification are owned by the parent; this file does not claim publication or physical-phone/real-walk acceptance.
