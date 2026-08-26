# Meshy 3D house test

Can Meshy make a 3D house for Burbz? Here is what I found.

## Short answer

I could not sign in. Meshy hands out API keys on a **Pro plan only** — free
accounts cannot create one at all. There is no key on this machine, so nothing
was generated and nothing was spent.

The other 3D service wired into this session, Higgsfield, is on a free plan
with **0 credits**. That route is shut too.

## To unblock it

1. Subscribe at https://www.meshy.ai/pricing
2. Make a key at https://www.meshy.ai/settings/api — it starts with `msy_`
3. Run it:

```bash
export MESHY_API_KEY="msy_..."
scripts/meshy-burbz-house.sh
```

That script is ready and tested as far as the key check. It builds the mesh,
textures it, and saves a `.glb` into `meshy_output/`. **30 credits** — 20 to
build, 10 to texture.

## Read this before you pay

A Meshy `.glb` will not drop into Burbz. Two reasons, and the second is the
bigger one.

**Burbz cannot load a .glb today.** The game ships `three.min.js` and nothing
else. There is no `GLTFLoader` anywhere in `public/burbz/`. Loading a mesh
means adding one first. (`quarry-pro` does load GLBs, but it pulls the loader
off a CDN — Burbz does not.)

**Burbz avoids meshes on purpose.** `academy_3d_core.js` says so at the top:

> Everything here is procedural three.js geometry: no downloaded meshes, no
> multi-megabyte GLB over mobile data. The whole Academy [...] is a few dozen
> KB of code that builds itself on the device.

That decision is doing real work. Burbz is a phone game people open on a walk.
A textured Meshy house runs 50–200 MB before you shrink it.

And the game already draws houses well. The village builder in `index.html`
does timber framing, masonry courses, quoins, dormers, thatch eaves, shingle
rows, chimneys, shutters, window boxes and lanterns — seeded per village,
graded for the time of day, across five settlement layouts.

## So what is Meshy good for here?

Not for shipping houses into the game. But it could earn its keep as a
**reference tool**: generate a house, look at it, then build that shape
procedurally. Concept art you can orbit.

If you want a new house *style* in Burbz, the cheapest path is still a new
entry in the procedural builder. No subscription, no loader, no download.

Your call. Tell me which way and I will build it.
