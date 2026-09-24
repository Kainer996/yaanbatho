// Burbz Bird Home Range Core — "Birds are not all over the show".
//
// Yaan's ask (2026-09-24): he hears the same two tawny owls at work every
// night and only learned they were the SAME two owls by asking a chatbot.
// Burbz should teach that. Most birds keep a patch. A robin lives in a garden
// or two; a tawny owl pair holds the same wood for life; a raven roams miles.
//
// This module answers three questions, with no DOM and no game state:
//   1. rangeFor(name)   — how far does this bird roam from where you met it,
//                         what colour is its patch, and how faithful is it?
//   2. recordEncounter  — add a sound or photo meeting to the patch log.
//   3. patchFor         — have you met this bird HERE before? If so, it is
//                         very likely the same bird, and we say so.
//
// Radii are the typical distance a bird travels from the heart of its home
// range: roughly sqrt(home range area / pi), rounded to a friendly number.
// Figures follow BTO/RSPB species accounts and the home-range literature.
// Species not listed get an estimate from body mass and way of life, marked
// `estimated: true` so the player is never told a guess is a fact.
// Pure module: UMD export, runs in the browser and in Node.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBirdHomeRangeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'bird-home-range-v465-20260924';
  const STORAGE_KEY = 'burbz.birdPatches.v1';
  const MAX_ENCOUNTERS = 800;
  // Two hearings closer than this in time are one visit, not two. A tawny
  // owl calling all evening is one night with that owl.
  const VISIT_GAP_MS = 45 * 60 * 1000;
  // Even a wren's patch should not be smaller than a phone's GPS error.
  const MIN_MATCH_M = 60;

  // radius (m) · faithful: 'life' | 'season' | 'roams' · pair · colour · note
  // Notes are short, plain and true. They teach one thing each.
  const RANGES = {
    'robin':                 { r: 50,   faithful: 'life',   pair: false, color: '#e8622c', note: 'A robin guards one garden or hedge all year. Robins even hold a winter patch alone.' },
    'wren':                  { r: 50,   faithful: 'life',   pair: false, color: '#9a6a3a', note: 'A wren stays in the same tangle of hedge and bramble all year.' },
    'dunnock':               { r: 45,   faithful: 'life',   pair: false, color: '#7d6a58', note: 'A dunnock creeps round the same few bushes all its life.' },
    'blackbird':             { r: 60,   faithful: 'life',   pair: true,  color: '#f2a007', note: 'A blackbird pair keeps the same garden patch year after year.' },
    'song thrush':           { r: 60,   faithful: 'season', pair: true,  color: '#b88a4a', note: 'A song thrush sings from the same few trees every spring evening.' },
    'mistle thrush':         { r: 150,  faithful: 'life',   pair: true,  color: '#a78655', note: 'A mistle thrush pair defends a big patch, and a berry tree in winter.' },
    'blue tit':              { r: 60,   faithful: 'season', pair: true,  color: '#2f8fd8', note: 'Blue tits nest in one small patch, then join roaming flocks in winter.' },
    'great tit':             { r: 70,   faithful: 'season', pair: true,  color: '#e2c21f', note: 'A great tit pair holds a small wood patch in spring and roams a little in winter.' },
    'coal tit':              { r: 70,   faithful: 'season', pair: true,  color: '#5b6470', note: 'Coal tits keep to the same conifers, season after season.' },
    'long tailed tit':       { r: 250,  faithful: 'roams',  pair: false, color: '#e7a3b8', note: 'Long-tailed tits roam as a family flock round a wide loop of woods.' },
    'chaffinch':             { r: 50,   faithful: 'season', pair: true,  color: '#c96a5a', note: 'A chaffinch sings the same song from the same trees all spring.' },
    'goldfinch':             { r: 300,  faithful: 'roams',  pair: false, color: '#d4262b', note: 'Goldfinches wander in small flocks between seed heads and feeders.' },
    'greenfinch':            { r: 200,  faithful: 'roams',  pair: false, color: '#7aa02c', note: 'Greenfinches travel between gardens in loose groups.' },
    'bullfinch':             { r: 150,  faithful: 'life',   pair: true,  color: '#e0567a', note: 'Bullfinch pairs stay together and keep to the same hedges.' },
    'house sparrow':         { r: 80,   faithful: 'life',   pair: true,  color: '#8a6a4a', note: 'House sparrows live in one colony. Most never move more than a street away.' },
    'tree sparrow':          { r: 150,  faithful: 'life',   pair: true,  color: '#a0703f', note: 'Tree sparrows stay near their nest colony all year.' },
    'starling':              { r: 500,  faithful: 'season', pair: false, color: '#3f7f6e', note: 'Starlings feed near home by day and fly off to a big roost at dusk.' },
    'goldcrest':             { r: 70,   faithful: 'season', pair: true,  color: '#e8d12a', note: 'Tiny goldcrests stay deep in the same conifers.' },
    'treecreeper':           { r: 120,  faithful: 'life',   pair: true,  color: '#9b7b56', note: 'A treecreeper spirals up the same trunks in the same wood all year.' },
    'nuthatch':              { r: 120,  faithful: 'life',   pair: true,  color: '#5f86b3', note: 'Nuthatch pairs hold one piece of woodland for life.' },
    'chiffchaff':            { r: 60,   faithful: 'season', pair: true,  color: '#a2a84b', note: 'A chiffchaff sings its name from the same trees all summer.' },
    'willow warbler':        { r: 60,   faithful: 'season', pair: true,  color: '#c2c25a', note: 'A willow warbler flies from Africa back to the same patch each spring.' },
    'blackcap':              { r: 60,   faithful: 'season', pair: true,  color: '#4d4a5c', note: 'A blackcap sings from one thicket all summer.' },
    'pied wagtail':          { r: 300,  faithful: 'season', pair: true,  color: '#6b6b6b', note: 'Pied wagtails walk the same car parks and lawns every day.' },
    'grey wagtail':          { r: 400,  faithful: 'life',   pair: true,  color: '#e6c229', note: 'A grey wagtail pair works the same stretch of stream.' },
    'dipper':                { r: 500,  faithful: 'life',   pair: true,  color: '#6b4630', note: 'A dipper pair owns a stretch of river about a kilometre long.' },
    'kingfisher':            { r: 600,  faithful: 'life',   pair: false, color: '#1aa3c9', note: 'A kingfisher patrols the same stretch of river, up to a couple of kilometres.' },
    'wood pigeon':           { r: 400,  faithful: 'season', pair: true,  color: '#8a93a8', note: 'Woodpigeons roost and nest in one place and fly out to fields to feed.' },
    'collared dove':         { r: 200,  faithful: 'life',   pair: true,  color: '#c8b49a', note: 'A collared dove pair stays together round the same houses all year.' },
    'stock dove':            { r: 400,  faithful: 'life',   pair: true,  color: '#7f8aa0', note: 'Stock doves stay near their nest tree and nearby fields.' },
    'magpie':                { r: 150,  faithful: 'life',   pair: true,  color: '#2c6ea3', note: 'A magpie pair holds the same few gardens and trees all year.' },
    'jay':                   { r: 250,  faithful: 'life',   pair: true,  color: '#c28a6a', note: 'A jay pair keeps one wood, and buries acorns all over it.' },
    'jackdaw':               { r: 600,  faithful: 'life',   pair: true,  color: '#57607a', note: 'Jackdaws pair for life and come back to the same chimney or tree hole.' },
    'rook':                  { r: 1000, faithful: 'life',   pair: true,  color: '#433c55', note: 'Rooks nest in the same rookery every year and feed in fields nearby.' },
    'carrion crow':          { r: 400,  faithful: 'life',   pair: true,  color: '#3a3a4a', note: 'A carrion crow pair holds the same territory year after year.' },
    'hooded crow':           { r: 500,  faithful: 'life',   pair: true,  color: '#6f6f7a', note: 'A hooded crow pair keeps the same patch all year.' },
    'raven':                 { r: 2500, faithful: 'life',   pair: true,  color: '#6a3fb5', note: 'Raven pairs hold a territory miles wide. Young ravens roam even further.' },
    'great spotted woodpecker': { r: 180, faithful: 'life', pair: true,  color: '#d0233a', note: 'A great spotted woodpecker drums from the same trees in the same wood.' },
    'green woodpecker':      { r: 350,  faithful: 'life',   pair: true,  color: '#4f9d3a', note: 'A green woodpecker laughs across the same fields and ant-filled lawns.' },
    'tawny owl':             { r: 250,  faithful: 'life',   pair: true,  color: '#b0662a', note: 'Tawny owls pair for life and hold the same patch of wood for life. Hear them tonight and you will hear the same two next year.' },
    'barn owl':              { r: 1200, faithful: 'life',   pair: true,  color: '#f0d9a8', note: 'A barn owl hunts the same fields and field edges every night.' },
    'little owl':            { r: 200,  faithful: 'life',   pair: true,  color: '#9c8a6a', note: 'A little owl pair sits on the same posts and old trees all year.' },
    'long eared owl':        { r: 800,  faithful: 'season', pair: true,  color: '#c07a3a', note: 'Long-eared owls hide in the same thicket by day.' },
    'short eared owl':       { r: 1200, faithful: 'roams',  pair: false, color: '#d4a45a', note: 'Short-eared owls follow the voles, so they move about a lot.' },
    'kestrel':               { r: 800,  faithful: 'life',   pair: true,  color: '#c0703a', note: 'A kestrel hovers over the same verges and fields day after day.' },
    'sparrowhawk':           { r: 1000, faithful: 'life',   pair: true,  color: '#6e7fa0', note: 'A sparrowhawk hunts a circuit of gardens and hedges about two kilometres wide.' },
    'buzzard':               { r: 900,  faithful: 'life',   pair: true,  color: '#8c5a35', note: 'A buzzard pair soars over the same valley and woods for years.' },
    'red kite':              { r: 2500, faithful: 'life',   pair: true,  color: '#c2452d', note: 'Red kites nest in one wood but drift miles to find food.' },
    'merlin':                { r: 2000, faithful: 'season', pair: true,  color: '#4a6aa0', note: 'Merlins hunt small birds across miles of open moor.' },
    'hobby':                 { r: 2500, faithful: 'season', pair: true,  color: '#6a4a4a', note: 'Hobbies hunt dragonflies and swallows over a wide summer range.' },
    'peregrine falcon':      { r: 3000, faithful: 'life',   pair: true,  color: '#35506e', note: 'A peregrine pair uses the same cliff or tower for life and hunts miles around it.' },
    'goshawk':               { r: 2500, faithful: 'life',   pair: true,  color: '#56647a', note: 'A goshawk pair keeps a big forest territory for years.' },
    'osprey':                { r: 5000, faithful: 'season', pair: true,  color: '#7a6048', note: 'Ospreys come back from Africa to the same nest, and fish lakes miles away.' },
    'golden eagle':          { r: 5000, faithful: 'life',   pair: true,  color: '#b5862f', note: 'A golden eagle pair holds a whole mountain range of territory.' },
    'white tailed eagle':    { r: 5000, faithful: 'life',   pair: true,  color: '#8a6a4a', note: 'Sea eagle pairs hold miles of coast for life.' },
    'cuckoo':                { r: 1000, faithful: 'season', pair: false, color: '#6f7f90', note: 'A cuckoo comes back to the same moor or reedbed each spring.' },
    'swift':                 { r: 8000, faithful: 'season', pair: true,  color: '#3e3a3a', note: 'Swifts nest in the same roof every year but feed miles up in the sky.' },
    'swallow':               { r: 500,  faithful: 'season', pair: true,  color: '#1f4e8c', note: 'Swallows fly back from Africa to the very same barn.' },
    'house martin':          { r: 450,  faithful: 'season', pair: true,  color: '#27427a', note: 'House martins come back to the same eaves every summer.' },
    'sand martin':           { r: 700,  faithful: 'season', pair: true,  color: '#a08a6a', note: 'Sand martins nest in the same river bank each year.' },
    'skylark':               { r: 150,  faithful: 'season', pair: true,  color: '#b3945e', note: 'A skylark sings high over its own small patch of field.' },
    'meadow pipit':          { r: 150,  faithful: 'season', pair: true,  color: '#9a8a5a', note: 'Meadow pipits parachute down onto the same bit of moor.' },
    'yellowhammer':          { r: 120,  faithful: 'season', pair: true,  color: '#f0c419', note: 'A yellowhammer sings from the same hedge top all summer.' },
    'reed bunting':          { r: 100,  faithful: 'season', pair: true,  color: '#7a5a3a', note: 'A reed bunting sings from the same reeds every spring.' },
    'stonechat':             { r: 100,  faithful: 'life',   pair: true,  color: '#d06b2e', note: 'A stonechat pair perches on the same gorse all year.' },
    'linnet':                { r: 300,  faithful: 'roams',  pair: false, color: '#b3564a', note: 'Linnets travel in chattering flocks across fields and heaths.' },
    'pheasant':              { r: 300,  faithful: 'life',   pair: false, color: '#b5442a', note: 'A pheasant walks the same woods and field edges every day.' },
    'grey partridge':        { r: 300,  faithful: 'life',   pair: true,  color: '#a0784a', note: 'Grey partridges keep to the same fields in family groups.' },
    'grey heron':            { r: 2000, faithful: 'life',   pair: false, color: '#8c9aab', note: 'A grey heron nests in the same heronry and fishes the same spots.' },
    'mallard':               { r: 600,  faithful: 'season', pair: true,  color: '#2f8a4a', note: 'Mallards stay round the same pond or river stretch for weeks.' },
    'mute swan':             { r: 1000, faithful: 'life',   pair: true,  color: '#e6e1d4', note: 'A mute swan pair holds the same river stretch or lake for life.' },
    'canada goose':          { r: 2000, faithful: 'season', pair: true,  color: '#5a4a3a', note: 'Canada geese commute between the same lakes and fields.' },
    'moorhen':               { r: 100,  faithful: 'life',   pair: true,  color: '#c8332c', note: 'A moorhen pair stays on the same pond all year.' },
    'coot':                  { r: 150,  faithful: 'season', pair: true,  color: '#303038', note: 'Coots guard their own patch of pond fiercely.' },
    'little grebe':          { r: 200,  faithful: 'season', pair: true,  color: '#8a4a2a', note: 'Little grebes keep to one pond or quiet river bend.' },
    'goosander':             { r: 3000, faithful: 'season', pair: false, color: '#2f6b5a', note: 'Goosanders fish long stretches of river.' },
    'cormorant':             { r: 5000, faithful: 'roams',  pair: false, color: '#2a3a3a', note: 'Cormorants fly miles between roost and fishing water.' },
    'lapwing':               { r: 300,  faithful: 'season', pair: true,  color: '#2e7a5a', note: 'Lapwings come back to the same wet fields to nest.' },
    'curlew':                { r: 700,  faithful: 'season', pair: true,  color: '#9a7a52', note: 'Curlews return to the same moorland fields every spring.' },
    'oystercatcher':         { r: 500,  faithful: 'life',   pair: true,  color: '#e0452a', note: 'Oystercatcher pairs can nest in the same field for twenty years.' },
    'snipe':                 { r: 300,  faithful: 'season', pair: false, color: '#8a6a44', note: 'Snipe drum over the same wet ground each spring.' },
    'herring gull':          { r: 5000, faithful: 'roams',  pair: true,  color: '#9aa7b3', note: 'Herring gulls nest on the same roof but fly miles to find food.' },
    'black headed gull':     { r: 4000, faithful: 'roams',  pair: false, color: '#7a2a2a', note: 'Black-headed gulls commute between roosts and fields every day.' },
    'ring necked parakeet':  { r: 1500, faithful: 'roams',  pair: false, color: '#3bb54a', note: 'Parakeets fly out from one big roost every morning.' },
    'waxwing':               { r: 3000, faithful: 'roams',  pair: false, color: '#c07a60', note: 'Waxwings wander from berry tree to berry tree.' },
    'crossbill':             { r: 3000, faithful: 'roams',  pair: false, color: '#b8362e', note: 'Crossbills wander wherever the cone crop is good.' },
    'firecrest':             { r: 70,   faithful: 'season', pair: true,  color: '#f07a1a', note: 'A firecrest stays in the same few evergreens.' },
    'redstart':              { r: 100,  faithful: 'season', pair: true,  color: '#d25a2a', note: 'A redstart comes back to the same old oak wood every spring.' },
    'pied flycatcher':       { r: 100,  faithful: 'season', pair: true,  color: '#3a3a3a', note: 'Pied flycatchers return to the same valley woods each spring.' },
    'spotted flycatcher':    { r: 100,  faithful: 'season', pair: true,  color: '#8a7a6a', note: 'A spotted flycatcher sallies from the same perch all summer.' },
    'tree pipit':            { r: 120,  faithful: 'season', pair: true,  color: '#a08a5a', note: 'A tree pipit sings from the same tree at the wood edge.' },
    'sedge warbler':         { r: 60,   faithful: 'season', pair: true,  color: '#9a7a4a', note: 'A sedge warbler chatters from the same reeds all summer.' },
    'nightingale':           { r: 80,   faithful: 'season', pair: true,  color: '#a0603a', note: 'A nightingale sings from the same thicket every May night.' },
    // Australia
    'australian magpie':     { r: 300,  faithful: 'life',   pair: false, color: '#3a3a3a', note: 'Australian magpies live in family groups that hold the same patch for years.' },
    'laughing kookaburra':   { r: 400,  faithful: 'life',   pair: false, color: '#8a6a3a', note: 'Kookaburra families laugh to mark the same territory every dawn.' },
    'rainbow lorikeet':      { r: 5000, faithful: 'roams',  pair: true,  color: '#2fa0e0', note: 'Lorikeets fly miles from roost to flowering trees each day.' },
    'noisy miner':           { r: 150,  faithful: 'life',   pair: false, color: '#b8a04a', note: 'Noisy miners live in colonies that guard the same trees.' },
    'superb fairywren':      { r: 80,   faithful: 'life',   pair: false, color: '#2a6ad8', note: 'A fairywren family stays in the same patch of shrubs all year.' },
    'willie wagtail':        { r: 100,  faithful: 'life',   pair: true,  color: '#2a2a2a', note: 'A willie wagtail pair guards the same lawn and fence line.' },
    'tawny frogmouth':       { r: 300,  faithful: 'life',   pair: true,  color: '#8a7a6a', note: 'Tawny frogmouth pairs roost in the same tree for years.' },
    'australian raven':      { r: 2000, faithful: 'life',   pair: true,  color: '#5a3fa0', note: 'Australian raven pairs hold a large territory for life.' },
    'little raven':          { r: 1500, faithful: 'roams',  pair: false, color: '#5a4aa0', note: 'Little ravens roam in flocks outside the nesting season.' },
    'galah':                 { r: 2000, faithful: 'roams',  pair: true,  color: '#e37ea0', note: 'Galahs pair for life and fly out in flocks to feed.' },
    'sulphur crested cockatoo': { r: 3000, faithful: 'roams', pair: true, color: '#f2e27a', note: 'Cockatoos commute in noisy flocks from a shared roost.' },
    'wedge tailed eagle':    { r: 5000, faithful: 'life',   pair: true,  color: '#6a4a2a', note: 'Wedge-tailed eagle pairs hold a territory many kilometres wide.' },
    'pied currawong':        { r: 500,  faithful: 'season', pair: true,  color: '#303040', note: 'Currawongs nest in one patch and move to towns in winter.' }
  };

  // Same bird, many names: "European Robin", "Eurasian Wren", "Common Raven".
  const ALIASES = {
    'woodpigeon': 'wood pigeon', 'common wood pigeon': 'wood pigeon',
    'heron': 'grey heron', 'peregrine': 'peregrine falcon',
    'northern raven': 'raven', 'common buzzard': 'buzzard',
    'common kestrel': 'kestrel', 'eurasian sparrowhawk': 'sparrowhawk',
    'northern goshawk': 'goshawk', 'eurasian hobby': 'hobby',
    'eurasian tree sparrow': 'tree sparrow', 'common linnet': 'linnet',
    'bohemian waxwing': 'waxwing', 'red crossbill': 'crossbill',
    'common snipe': 'snipe', 'common redstart': 'redstart',
    'common nightingale': 'nightingale', 'western jackdaw': 'jackdaw',
    'eurasian jay': 'jay', 'eurasian magpie': 'magpie',
    'common chiffchaff': 'chiffchaff', 'eurasian blackcap': 'blackcap',
    'eurasian blue tit': 'blue tit', 'eurasian bullfinch': 'bullfinch',
    'european goldfinch': 'goldfinch', 'european greenfinch': 'greenfinch',
    'common starling': 'starling', 'eurasian treecreeper': 'treecreeper',
    'eurasian nuthatch': 'nuthatch', 'white wagtail': 'pied wagtail',
    'white throated dipper': 'dipper', 'common kingfisher': 'kingfisher',
    'eurasian collared dove': 'collared dove', 'stock pigeon': 'stock dove',
    'western barn owl': 'barn owl', 'eurasian skylark': 'skylark',
    'common pheasant': 'pheasant', 'common moorhen': 'moorhen',
    'eurasian coot': 'coot', 'northern lapwing': 'lapwing',
    'eurasian curlew': 'curlew', 'eurasian oystercatcher': 'oystercatcher',
    'european herring gull': 'herring gull', 'common swift': 'swift',
    'barn swallow': 'swallow', 'common house martin': 'house martin',
    'common cuckoo': 'cuckoo', 'great cormorant': 'cormorant',
    'common goldeneye': 'goldeneye', 'common merganser': 'goosander',
    'european stonechat': 'stonechat', 'common reed bunting': 'reed bunting',
    'eurasian wren': 'wren', 'northern wren': 'wren', 'winter wren': 'wren',
    'european robin': 'robin', 'common blackbird': 'blackbird',
    'eurasian blackbird': 'blackbird', 'tawny': 'tawny owl',
    'long tailed bushtit': 'long tailed tit'
  };

  function keyOf(name) {
    let k = String(name || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    if (!k) return '';
    if (ALIASES[k]) return ALIASES[k];
    if (RANGES[k]) return k;
    const bare = k.replace(/^(common|european|eurasian|northern|western|great) /, '');
    if (ALIASES[bare]) return ALIASES[bare];
    if (RANGES[bare]) return bare;
    return k;
  }

  // A stable, readable colour for any bird we have no curated colour for.
  function hashColor(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    const hue = Math.abs(h) % 360;
    return 'hsl(' + hue + ', 62%, 48%)';
  }

  // Estimate for birds we have not curated. Home range grows with body mass
  // (roughly mass^0.6 for radius) and hunters range much further than
  // seed-eaters of the same size. Clamped to 40 m – 6 km.
  function estimateRadius(massG, guild) {
    const mass = Number(massG);
    const m = Number.isFinite(mass) && mass > 0 ? mass : 60;
    let r = 55 * Math.pow(m / 20, 0.6);
    const g = String(guild || '').toLowerCase();
    if (/raptor|osprey|kite|vulture|owl|falcon|eagle|hawk|hunter/.test(g)) r *= 3;
    else if (/aerial|oceanic|gull|fisher|pouch|swimmer|seabird|water/.test(g)) r *= 2.5;
    else if (/corvid|parrot/.test(g)) r *= 2;
    return Math.round(Math.max(40, Math.min(6000, r)) / 10) * 10;
  }

  function rangeFor(name, opts) {
    const key = keyOf(name);
    const known = RANGES[key];
    if (known) {
      return { key, radiusM: known.r, faithful: known.faithful, pair: known.pair,
        color: known.color, note: known.note, estimated: false };
    }
    const o = opts || {};
    const radiusM = estimateRadius(o.massG, o.guild);
    return { key, radiusM, faithful: 'season', pair: false, color: hashColor(key || 'bird'),
      note: 'Most birds keep to a home patch. This one roams about ' + formatDistance(radiusM) + ' from here.',
      estimated: true };
  }

  function formatDistance(m) {
    const v = Number(m) || 0;
    if (v >= 1000) return (Math.round(v / 100) / 10).toString().replace(/\.0$/, '') + ' km';
    return Math.round(v / 10) * 10 + ' m';
  }

  // Haversine distance in metres.
  function distanceM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function validPoint(p) {
    return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
  }

  function normaliseLog(log) {
    return Array.isArray(log) ? log.filter(e => e && e.key && validPoint(e) && Number.isFinite(e.t)) : [];
  }

  // The patch is every earlier meeting with this species within its range of
  // here. Its heart is the average of those points, so the circle settles on
  // where the bird really lives as the player keeps meeting it.
  function patchFor(log, name, point, opts) {
    const range = rangeFor(name, opts);
    const entries = normaliseLog(log).filter(e => e.key === range.key);
    if (!validPoint(point)) return { range, encounters: [], visits: 0, center: null };
    const matchM = Math.max(MIN_MATCH_M, range.radiusM);
    const near = entries.filter(e => distanceM(e, point) <= matchM).sort((a, b) => a.t - b.t);
    let visits = 0, lastT = -Infinity;
    const days = new Set();
    for (const e of near) {
      if (e.t - lastT > VISIT_GAP_MS) visits++;
      lastT = e.t;
      days.add(new Date(e.t).toISOString().slice(0, 10));
    }
    const center = near.length
      ? { lat: near.reduce((s, e) => s + e.lat, 0) / near.length, lng: near.reduce((s, e) => s + e.lng, 0) / near.length }
      : { lat: point.lat, lng: point.lng };
    return { range, encounters: near, visits, days: days.size, center,
      firstT: near.length ? near[0].t : null, lastT: near.length ? near[near.length - 1].t : null };
  }

  // Adds a meeting and returns { log, patch, lesson }. The patch is read
  // BEFORE the new meeting is added, so the lesson can say "again".
  function recordEncounter(log, name, point, opts) {
    const o = opts || {};
    const now = Number.isFinite(o.now) ? o.now : Date.now();
    const clean = normaliseLog(log);
    const range = rangeFor(name, o);
    if (!range.key || !validPoint(point)) return { log: clean, patch: null, lesson: null };
    const before = patchFor(clean, name, point, o);
    const entry = { key: range.key, name: String(name).slice(0, 60), lat: +(+point.lat).toFixed(6),
      lng: +(+point.lng).toFixed(6), t: now, via: o.via === 'photo' ? 'photo' : 'sound' };
    const next = clean.concat(entry).slice(-MAX_ENCOUNTERS);
    const after = patchFor(next, name, point, o);
    return { log: next, patch: after, lesson: lessonFor(name, before, after, now) };
  }

  function agoText(ms) {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return mins <= 1 ? 'a minute ago' : mins + ' minutes ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? 'an hour ago' : hours + ' hours ago';
    const days = Math.round(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 14) return days + ' days ago';
    const weeks = Math.round(days / 7);
    if (weeks < 9) return weeks + ' weeks ago';
    return Math.round(days / 30) + ' months ago';
  }

  function article(name) { return /^[aeiou]/i.test(name) ? 'an' : 'a'; }

  // One short lesson per meeting. The first meeting teaches the patch; a
  // return visit teaches "same bird"; later visits make it a neighbour.
  function lessonFor(name, before, after, now) {
    const range = after.range;
    const bird = String(name || 'bird');
    const size = formatDistance(range.radiusM);
    const who = range.pair ? 'the same pair' : 'the same bird';
    const isNewVisit = !before.lastT || (now - before.lastT) > VISIT_GAP_MS;
    if (!before.encounters.length) {
      return { kind: 'first', title: 'New neighbour',
        text: bird + ' lives around here. It keeps to about ' + size + ' from this spot. ' + range.note,
        visits: after.visits };
    }
    if (!isNewVisit) {
      return { kind: 'same-visit', title: 'Still here',
        text: 'Still the same ' + bird + '. It is staying in its patch.', visits: after.visits };
    }
    const ago = agoText(now - before.lastT);
    if (after.visits === 2) {
      const tail = range.faithful === 'roams'
        ? ' This kind roams more than most, but it came back.'
        : ' Birds are not all over the place. Each one keeps its own patch.';
      return { kind: 'same-bird', title: 'Same ' + bird + '!',
        text: 'You met ' + article(bird) + ' ' + bird + ' right here ' + ago + '. It is almost certainly ' + who + '.' + tail,
        visits: after.visits };
    }
    return { kind: 'neighbour', title: 'Your ' + bird + ' again',
      text: 'Visit ' + after.visits + ' with ' + who + ' on this patch. Last time was ' + ago + '. You are getting to know your neighbour.',
      visits: after.visits };
  }

  // Every patch the player knows, for drawing on the map.
  function knownPatches(log, opts) {
    const entries = normaliseLog(log).sort((a, b) => a.t - b.t);
    const patches = [];
    for (const e of entries) {
      const range = rangeFor(e.name || e.key, opts);
      const matchM = Math.max(MIN_MATCH_M, range.radiusM);
      let home = patches.find(p => p.key === e.key && distanceM(p.center, e) <= matchM);
      if (!home) {
        home = { key: e.key, name: e.name || e.key, range, points: [], center: { lat: e.lat, lng: e.lng }, visits: 0, lastT: -Infinity };
        patches.push(home);
      }
      if (e.t - home.lastT > VISIT_GAP_MS) home.visits++;
      home.lastT = e.t;
      home.points.push(e);
      const n = home.points.length;
      home.center = { lat: home.center.lat + (e.lat - home.center.lat) / n, lng: home.center.lng + (e.lng - home.center.lng) / n };
    }
    return patches;
  }

  function loadLog(storage) {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      return normaliseLog(raw ? JSON.parse(raw) : []);
    } catch (_) { return []; }
  }

  function saveLog(storage, log) {
    try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normaliseLog(log).slice(-MAX_ENCOUNTERS))); return true; }
    catch (_) { return false; }
  }

  return { VERSION, STORAGE_KEY, MAX_ENCOUNTERS, VISIT_GAP_MS, MIN_MATCH_M, RANGES,
    keyOf, rangeFor, estimateRadius, formatDistance, distanceM, patchFor,
    recordEncounter, lessonFor, knownPatches, loadLog, saveLog, agoText };
});
