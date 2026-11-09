import { describe, it, expect } from 'vitest';
import { recognizeGesture } from '../src/game/input/controls';
import { Match } from '../src/game/physics/match';
import { DEFAULT_OPTIONS } from '../src/game/data/save';
import { forecast } from '../src/game/physics/ball';

describe('arcade gestures', () => {
  it.each([
    [0, 0, 70, 'flat'], [0, -60, 160, 'topspin'],
    [0, 65, 150, 'backspin'], [-70, 0, 150, 'side-left'],
    [70, -45, 150, 'side-right'], [20, 5, 200, 'drop'],
    [0, -150, 100, 'forehand'],
  ])('recognizes %s,%s over %s ms as %s', (x,y,ms,shot) => {
    expect(recognizeGesture(Number(x),Number(y),Number(ms)).shot).toBe(shot);
  });
  it('preserves screen direction and increases power with speed', () => {
    expect(recognizeGesture(-100, -30, 150).aim).toBeLessThan(0);
    expect(recognizeGesture(100, -30, 150).aim).toBeGreaterThan(0);
    expect(recognizeGesture(100, -30, 80).charge).toBeGreaterThan(recognizeGesture(100,-30,400).charge);
  });
});

describe('assisted physical returns', () => {
  const make = (assistance: 'EASY' | 'MANUAL' = 'EASY') => new Match({
    hero:'tony', opponent:'viktor', arena:0, mode:'training',
    options:{...DEFAULT_OPTIONS, assistance}, seed:1982,
  });
  it('moves feet toward the intercept with no movement input', () => {
    const m=make(); m.state='playing'; m.ball.active=true; m.ball.p={x:0.5,y:0.4,z:0.6}; m.ball.v={x:0,y:2,z:0};
    m.update(0.1,{x:0,y:0}); expect(m.players[0].x).toBeGreaterThan(0);
    const manual=make('MANUAL'); manual.state='playing'; manual.ball.active=true; manual.ball.p={x:0.5,y:0.4,z:0.6}; manual.ball.v={x:0,y:2,z:0};
    manual.update(0.1,{x:0,y:0}); expect(manual.players[0].x).toBe(0);
  });
  it('buffers an early tap into a legal contact but never returns without intent', () => {
    for (const tap of [true,false]) {
      const m=make(); m.state='playing'; m.ball.active=true; m.rules.phase='rally'; m.rules.lastHit=1; m.rules.bounces=1;
      m.ball.p={x:0,y:0.9,z:0.55}; m.ball.v={x:0,y:2,z:1};
      if(tap) m.input({shot:'flat',aim:0,charge:0,mixed:0});
      for(let i=0;i<55;i++) m.update(1/120,{x:0,y:0});
      expect(m.rally).toBe(tap ? 1 : 0);
    }
  });
  it('sustains a beginner rally using early taps and automatic feet', () => {
    const m=make(); let last=-1;
    for(let i=0;i<120*120 && m.bestRally<12;i++) {
      if(m.state==='ready' && m.rules.server===0) m.input({shot:'flat',aim:0,charge:0,mixed:0});
      if(m.state==='playing' && m.ball.v.y>0 && m.rules.bounces>0 && last!==m.rally) {
        const eta=forecast(m.ball,m.playerPlane).time;
        if(eta>0 && eta<0.3) { m.input({shot:'flat',aim:0,charge:0,mixed:0});last=m.rally; }
      }
      if(m.state==='point') last=-1;
      m.update(1/120,{x:0,y:0});
    }
    expect(m.bestRally).toBeGreaterThanOrEqual(12);
  });
});

import { ARENAS } from '../src/game/data/arenas';
it('keeps the bright ball distinct from every table surface', () => {
  const luminance = (rgb:number) => [16,8,0].map(shift => (rgb >> shift & 255)/255)
    .map(c => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4)
    .reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
  for(const arena of ARENAS) {
    expect((luminance(0xfffbd6)+0.05)/(luminance(arena.table)+0.05), arena.name).toBeGreaterThan(3);
  }
});
