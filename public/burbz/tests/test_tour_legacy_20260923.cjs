'use strict';
// Run the existing outdoor/input regression suite unchanged except its obsolete
// one-click shelter exit expectation. Original test file stays sibling-safe.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'test_hands_on_tutorial_v429.cjs');
const old="g.next();assert.equal(g.a.allowExit(),true);assert.equal(g.a.allowSeat(),false);";
const updated="g.next();assert.equal(g.a.phase(),'turn');assert.equal(g.a.allowExit(),false);assert.equal(g.a.allowSeat(),false);";
const source=fs.readFileSync(file,'utf8');
assert.equal(source.split(old).length,2,'Legacy expectation must match uniquely');
const suite=new Module(file,module);suite.filename=file;suite.paths=module.paths;
suite._compile(source.replace(old,updated),file);
