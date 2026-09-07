'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../geographic_camera_core.js');

function intersects(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
function area(rect) { return rect ? rect.width * rect.height : 0; }

test('portrait framing honours actual card top instead of inventing a minimum map height', () => {
  const result = core.visibleRect({width:390, height:526}, {
    padding:{top:63, left:28, right:28, bottom:18}, gap:18,
    occluders:[{left:10, top:131, right:380, bottom:495}]
  });
  assert.deepEqual(result, {left:28, top:63, right:362, bottom:113, width:334, height:50});
});

test('landscape can use the full-height side of a wide quest card', () => {
  const result = core.visibleRect({width:844, height:390}, {
    padding:16, gap:12,
    occluders:[{left:10, top:90, right:420, bottom:380}]
  });
  assert.deepEqual(result, {left:432, top:16, right:828, bottom:374, width:396, height:358});
});

test('overlapping controls, markers and card rectangles leave a genuinely unoccluded region', () => {
  const occluders = [
    {left:8, top:76, right:58, bottom:182},
    {left:8, top:170, right:60, bottom:232},
    {left:10, top:280, right:380, bottom:520},
    {left:300, top:5, right:390, bottom:60}
  ];
  const result = core.visibleRect({width:390, height:526}, {padding:12, gap:10, occluders});
  assert.ok(result.width > 200 && result.height > 150);
  for (const obstacle of occluders) {
    assert.equal(intersects(result, {left:obstacle.left-10, top:obstacle.top-10, right:obstacle.right+10, bottom:obstacle.bottom+10}), false);
  }
});

test('occlusion solver agrees with exhaustive empty-rectangle search across deterministic layouts', () => {
  let seed = 613;
  const random = () => ((seed = (seed * 48271) % 2147483647) % 8);
  for (let sample = 0; sample < 40; sample++) {
    const obstacles = Array.from({length:3}, () => {
      const x = random(), y = random();
      return {left:x, top:y, right:Math.min(8,x+1+random()%3), bottom:Math.min(8,y+1+random()%3)};
    });
    let maximum = 0;
    for (let x1=0; x1<8; x1++) for (let x2=x1+1; x2<=8; x2++) {
      for (let y1=0; y1<8; y1++) for (let y2=y1+1; y2<=8; y2++) {
        const candidate={left:x1, right:x2, top:y1, bottom:y2};
        if (!obstacles.some(obstacle => intersects(candidate,obstacle))) maximum=Math.max(maximum,(x2-x1)*(y2-y1));
      }
    }
    assert.equal(area(core.visibleRect({width:8,height:8},{occluders:obstacles})),maximum);
  }
});

test('fully hidden or invalid viewports report no area; off-map obstacles do not shrink the view', () => {
  assert.equal(core.visibleRect({width:320,height:180},{occluders:[{left:-5,top:-5,right:325,bottom:185}]}),null);
  assert.equal(core.visibleRect({width:0,height:300}),null);
  assert.equal(core.visibleRect({width:320,height:180},{padding:100}),null);
  assert.equal(core.visibleRect({width:NaN,height:180}),null);
  assert.equal(area(core.visibleRect({width:320,height:180},{occluders:[{left:400,top:0,right:450,bottom:300}]})),57600);
});

test('every vertex counts, including the same path on a return leg and an interior extreme', () => {
  const points = Object.freeze([[30,50],[270,-25],[20,200],[270,-25],[30,50]].map(Object.freeze));
  const before = JSON.stringify(points);
  assert.deepEqual(core.projectedBounds(points),{left:20,top:-25,right:270,bottom:200,width:250,height:225,count:5});
  assert.notEqual(core.frameCorrection(points,{width:300,height:200}).status,'fit');
  assert.equal(JSON.stringify(points),before);
});

test('bad or missing projections cannot pass by discarding inconvenient vertices', () => {
  for (const bad of [{x:NaN,y:20},{x:10,y:Infinity},null,undefined,['4',20]]) {
    assert.equal(core.frameCorrection([{x:10,y:20},bad,{x:30,y:40}],{width:300,height:200}).status,'invalid');
  }
  assert.equal(core.frameCorrection([],{width:300,height:200}).reason,'no-points');
  assert.equal(core.frameCorrection([[10,20]],{width:0,height:200}).reason,'no-visible-area');
});

test('fit includes configurable subpixel tolerance and does not move an already visible walk', () => {
  const points = [[20,19.5],[280,180.5]], rect={left:20,top:20,right:280,bottom:180};
  assert.deepEqual(core.frameCorrection(points,rect).screenShift,[0,0]);
  assert.equal(core.frameCorrection(points,rect).status,'fit');
  assert.equal(core.frameCorrection(points,rect,{tolerance:0}).status,'zoom-out');
});

test('oversized projections request capped zoom-out before any pan', () => {
  const result = core.frameCorrection([[-4000,-900],[3000,600]],{left:20,top:60,right:370,bottom:260},{maxZoomOutStep:.75});
  assert.equal(result.status,'zoom-out');
  assert.equal(result.zoomDelta,-.75);
  assert.deepEqual(result.screenShift,[0,0]);
});

test('small offscreen walks request a correctly signed content translation, preserving the visible axis', () => {
  const rect={left:30,top:60,right:370,bottom:250};
  const points=[[60,280],[270,350]];
  const result=core.frameCorrection(points,rect);
  assert.equal(result.status,'pan');
  assert.equal(result.zoomDelta,0);
  assert.deepEqual(result.screenShift,[0,-160]);
  const translated=points.map(([x,y]) => [x+result.screenShift[0],y+result.screenShift[1]]);
  assert.equal(core.frameCorrection(translated,rect).status,'fit');
});

test('a single checkpoint and a vertical route do not cause divide-by-zero or unnecessary zooming', () => {
  for (const points of [[[400,20]],[[400,20],[400,80],[400,140]]]) {
    const result=core.frameCorrection(points,{width:320,height:180});
    assert.equal(result.status,'pan');
    assert.equal(result.zoomDelta,0);
    const corrected=points.map(([x,y]) => [x+result.screenShift[0],y+result.screenShift[1]]);
    assert.equal(core.frameCorrection(corrected,{width:320,height:180}).status,'fit');
  }
});

// Independent pinhole projection with uneven ground. The consumer applies
// the requested zoom OR screen pan and then reprojects the untouched route.
function pitchedFixture(width,height,pitch) {
  const radians=pitch*Math.PI/180, sin=Math.sin(radians), cos=Math.cos(radians), distance=800;
  const camera={x:0,y:0,zoom:2};
  return {
    camera,
    project(point) {
      const scale=2**camera.zoom, x=point.x-camera.x, y=point.y-camera.y;
      const depth=distance-(y*sin+point.elevation*cos)*scale;
      return [width/2+x*scale*distance/depth,height/2+(y*cos-point.elevation*sin)*scale*distance/depth];
    },
    apply(step) {
      if (step.status==='zoom-out') camera.zoom+=step.zoomDelta;
      else if (step.status==='pan') {
        const scale=2**camera.zoom, sx=-step.screenShift[0], sy=-step.screenShift[1];
        const groundY=sy*distance/(scale*(cos*distance+sy*sin));
        const groundX=sx*(distance-groundY*sin*scale)/(scale*distance);
        camera.x+=groundX; camera.y+=groundY;
      }
    }
  };
}

test('bounded corrections fit every elevated pitched vertex in portrait and landscape without route mutation', () => {
  const route=Object.freeze([
    {x:-110,y:-75,elevation:15},{x:-15,y:-110,elevation:4},
    {x:110,y:-20,elevation:28},{x:85,y:90,elevation:12},
    {x:-60,y:105,elevation:25},{x:-110,y:-75,elevation:15}
  ].map(Object.freeze));
  const before=JSON.stringify(route);
  for (const [width,height] of [[390,526],[320,480],[844,300],[1280,746]]) {
    for (const pitch of [35,30,0]) {
      const fixture=pitchedFixture(width,height,pitch);
      const rect=core.visibleRect({width,height},{padding:{left:28,right:28,top:40,bottom:0},gap:18,occluders:[{left:0,top:height*.58,right:width,bottom:height}]});
      let step, iterations=0;
      do {
        step=core.frameCorrection(route.map(fixture.project),rect,{tolerance:.5});
        fixture.apply(step);
        iterations++;
      } while (step.status!=='fit' && step.status!=='invalid' && iterations<12);
      assert.equal(step.status,'fit',`${width}×${height}, pitch ${pitch}, ${JSON.stringify(step)}`);
      assert.ok(iterations<12);
      for (const [x,y] of route.map(fixture.project)) {
        assert.ok(x>=rect.left-.5 && x<=rect.right+.5 && y>=rect.top-.5 && y<=rect.bottom+.5);
      }
    }
  }
  assert.equal(JSON.stringify(route),before);
});

test('theme/card remeasurement computes a new fit area without mutating the measurements', () => {
  const viewport=Object.freeze({width:390,height:526});
  const card=Object.freeze({left:10,top:280,right:380,bottom:510});
  const before=JSON.stringify({viewport,card});
  const normal=core.visibleRect(viewport,{occluders:[card],padding:20,gap:12});
  const comic=core.visibleRect(viewport,{occluders:[{...card,top:250}],padding:20,gap:12});
  assert.equal(normal.bottom-comic.bottom,30);
  assert.equal(JSON.stringify({viewport,card}),before);
});
