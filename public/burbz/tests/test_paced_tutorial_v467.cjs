'use strict';
// Paced apprenticeship (v467). After Alderwing each lesson teaches one thing,
// then Merlin rests while the player practises it (Koster, A Theory of Fun).
// Also pins the Merlin play-flight fixes: no Play lesson, the flight never
// runs behind the care menu, and no lesson talks over it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function source(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
function constant(name, end = '\n];') {
  const start = html.indexOf('const ' + name + ' = ');
  assert(start >= 0, name);
  return html.slice(start, html.indexOf(end, start) + end.length);
}

// ---- The lesson list -------------------------------------------------------
const ctx = vm.createContext({});
vm.runInContext(constant('MERLIN_TUTORIAL_CHAPTERS') + '\n' + constant('MERLIN_TUTORIAL_STEPS') + '\nthis.chapters=MERLIN_TUTORIAL_CHAPTERS;this.steps=MERLIN_TUTORIAL_STEPS;', ctx);
const { chapters, steps } = JSON.parse(JSON.stringify({ chapters:ctx.chapters, steps:ctx.steps }));
const chapterIds = chapters.map(c => c.id);
assert(!steps.some(s => s.action && s.action.event === 'merlin-played'), 'No lesson asks the player to Play with Merlin');
assert(!steps.some(s => s.id === 'opening-companion-play'));
assert(!chapterIds.includes('academy_tour'), 'The walk-home bridge is retired');
for (const id of chapterIds) assert(steps.some(s => s.chapterId === id), 'Every chapter can be seen, so the completion gift stays reachable: ' + id);
for (const s of steps) assert(chapterIds.includes(s.chapterId), 'Every step belongs to a chapter: ' + s.id);
assert.equal(new Set(steps.map(s => s.id)).size, steps.length, 'Lesson ids stay unique');
const meet = steps.find(s => s.id === 'lesson-3');
assert.equal(meet.chapterId, 'companion', 'Meet Merlin is its own lesson on Home');
assert.equal(meet.screen, 'scan');
assert.equal(steps.filter(s => s.chapterId === 'companion').length, 1, 'Meet Merlin is one tap');
const start = steps.findIndex(s => s.id === 'alderwing-desk-v395');
const opening = ['story', 'academy', 'scan', 'companion', 'kitchen_need', 'quests', 'errand', 'care', 'explore'];
const after = steps.slice(start).filter(s => opening.includes(s.chapterId));
assert.equal(after.length, 12, 'After Alderwing the opening is 12 bubbles, down from 22');
assert.deepEqual(after.map(s => s.chapterId).filter((c, i, a) => a.indexOf(c) === i), opening);
assert.equal(steps.filter(s => s.chapterId === 'scan').length, 1, 'Discovery is one doing step');
assert.equal(steps.filter(s => s.chapterId === 'academy').length, 1, 'Building the Birdhouse is one doing step');
for (const s of after) {
  const sentences = s.text.split(/(?<=[.!?])\s+/);
  assert(sentences.every(x => x.split(/\s+/).length <= 16), 'Short sentences: ' + s.id);
}

// ---- Pacing rules ----------------------------------------------------------
let store = {}, now = 1_000_000;
const pace = vm.createContext({
  BURBZ_TUTORIAL_VERSION:'test', Date:{ now:() => now },
  localStorage:{ getItem:k => (k in store ? store[k] : null), setItem:(k, v) => { store[k] = String(v); }, removeItem:k => { delete store[k]; } },
  merlinFlightSession:null
});
vm.runInContext([
  constant('MERLIN_LESSON_GROUPS', '};'), constant('MERLIN_LESSON_REST_MS', ';'), constant('BURBZ_TUTORIAL_REST_KEY', ';'),
  ...['merlinLessonGroup', 'merlinLessonContinues', 'merlinLessonResting', 'startMerlinLessonRest', 'endMerlinLessonRest', 'merlinPlayFlightActive'].map(source)
].join('\n'), pace);
const call = code => vm.runInContext(code, pace);
assert.equal(call('MERLIN_LESSON_REST_MS'), 120000, 'Merlin rests for two minutes');
assert.equal(call("merlinLessonContinues('story','academy')"), true, 'Tap Academy flows into building the Birdhouse');
assert.equal(call("merlinLessonContinues('kitchen_need','quests')"), true, 'The Kitchen shortage flows into the supply errand');
assert.equal(call("merlinLessonContinues('quests','errand')"), true);
assert.equal(call("merlinLessonContinues('errand','care')"), true);
assert.equal(call("merlinLessonContinues('academy','scan')"), false, 'A built Birdhouse rests before discovery');
assert.equal(call("merlinLessonContinues('scan','companion')"), false);
assert.equal(call("merlinLessonContinues('companion','kitchen_need')"), false, 'Meeting Merlin rests before the Kitchen');
assert.equal(call("merlinLessonContinues('care','explore')"), false);
assert.equal(call("merlinLessonContinues('battle',null)"), false);
assert.equal(call('merlinLessonResting()'), false);
call('startMerlinLessonRest()');
assert.equal(call('merlinLessonResting()'), true);
now += 119000; assert.equal(call('merlinLessonResting()'), true);
now += 2000; assert.equal(call('merlinLessonResting()'), false, 'The rest ends by itself');
call('startMerlinLessonRest()'); call('endMerlinLessonRest()');
assert.equal(call('merlinLessonResting()'), false, 'The Home goal ends the rest at once');
store[call('BURBZ_TUTORIAL_REST_KEY')] = String(now + 5 * 86400000);
assert.equal(call('merlinLessonResting()'), false, 'A clock set backwards never stretches the rest');
store = {}; pace.localStorage.getItem = () => { throw Error('blocked'); }; pace.localStorage.setItem = () => { throw Error('blocked'); };
assert.equal(call('merlinLessonResting()'), false, 'Blocked storage never locks the lessons away');
call('startMerlinLessonRest()');
assert.equal(call('merlinPlayFlightActive()'), false);
pace.merlinFlightSession = { active:true };
assert.equal(call('merlinPlayFlightActive()'), true);

// ---- Wiring ----------------------------------------------------------------
const trigger = source('maybeStartMerlinChapterForScreen');
assert.match(trigger, /merlinPlayFlightActive\(\) \|\| \(!options\.handoff && merlinLessonResting\(\)\)/, 'Automatic lessons wait for the rest and never start mid-flight');
assert.match(source('maybeStartMerlinEmpirePageChapter'), /merlinLessonResting\(\)/);
const ending = source('endMerlinTutorial');
assert.match(ending, /lessonContinues = merlinLessonContinues\(merlinTutMode, nextOpeningChapter\(\)\)/);
assert.match(ending, /if \(completed && lessonContinues && typeof maybeStartMerlinChapterForScreen === 'function'\)/, 'Only a lesson’s own next chapter follows straight on');
assert.match(ending, /startMerlinLessonRest\(\)/);
const next = source('nextOpeningChapter');
assert.match(next, /case 'discovery': return 'scan';/);
assert.match(next, /case 'companion': return 'companion';/);
const goal = source('activateHomeCurrentGoal');
assert(goal.indexOf('endMerlinLessonRest()') >= 0 && goal.indexOf('endMerlinLessonRest()') < goal.indexOf('activateMerlinCurrentAction()'), 'The Home goal ends the rest before it acts');
assert.match(goal, /startMerlinTutorial\(\{chapterId,resume:true\}\);if \(merlinTutActive\) return;/, 'A lesson that cannot start falls back to plain navigation');
assert.equal(call("merlinLessonGroup('constructor')"), 'constructor', 'Only real lesson groups are read');

// ---- Merlin's play flight --------------------------------------------------
assert.match(source('petFlyOutAndReturn'), /onTakeoff: \(\) => \{[\s\S]*?closeMerlinCareMenu\(\{ force:true \}\)/, 'Takeoff always clears the care menu');
assert.match(source('openMerlinCareMenu'), /if \(merlinFlightSession\?\.active\) merlinFlightSession\.stop\('care', \{ immediate:true \}\);/, 'Care lands Merlin before the menu opens');
assert.match(source('careForMerlin'), /if \(action === 'play' && merlinTutActive\)/, 'Play waits while a lesson is on screen');
assert.match(source('startMerlinTutorial'), /if \(merlinPlayFlightActive\(\)\) merlinFlightSession\.stop\('lesson', \{ immediate:true \}\);/);
console.log('paced tutorial v467: ok');
