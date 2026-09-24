# Superseded PR397 acceptance fixtures

These exact former test/runner sources are retained with `.historical` suffixes, outside active test discovery. Their merged Academy/Home, room projection and takeover-intro expectations were explicitly rejected by the user on 2026-09-24. They are not current acceptance tests and must not be run against the separated interface.

Current regression: `../test_separate_home_20260924.cjs`. Existing Home, Academy, Hall, quest, expedition and Merlin tests remain active. The historical `academy_home_intro.js` module is retained in source but has no consuming script, worker precache entry or updater inclusion.

Browser, installed-update and offline validation of separation belongs to the parent release reviewer; no browser acceptance is claimed here.
