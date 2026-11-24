// 20 additional pieces. Built in millimetres; mm() scales to metres.
export function buildExtras(THREE, h) {
  const { pendantStone, linkChain, LOOP, LT, silver, chainMat, tube, bead, setStone, stone, spaced, mm, mesh, V, UP } = h;
  const silverDS = silver.clone(); silverDS.side = THREE.DoubleSide;
  const PI = Math.PI, TAU = PI * 2, R = 9.3;
  const grp = (n) => { const g = new THREE.Group(); g.name = n; return g; };
  const torus = (n, r, t, rs = 128) => mesh(n, new THREE.TorusGeometry(r, t, 24, rs), silver);
  const loop = (Rr, drop, k) => (t) => { const a = t * TAU, f = Math.pow((1 + Math.cos(a)) / 2, 2.2); return V(Rr * Math.sin(a), -drop * f, Rr * k * Math.cos(a)); };
  const teardrop = (w, ht, cx, cy, cz) => (t) => { const a = t * TAU; return V(cx + w * Math.sin(a) * Math.abs(Math.sin(a / 2)), cy + ht * Math.cos(a), cz); };
  // heart, cusp at (cx, cy) top, tip pointing down
  const heart = (s, cx, cy, cz) => (t) => { const a = t * TAU; return V(cx + s * 16 * Math.pow(Math.sin(a), 3), cy - 5 * s + s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)), cz); };
  const bale = (n, p, r = 1.1) => { const b = torus(n, r, .32, 32); b.position.copy(p); b.rotation.y = PI / 2; return b; };
  const neckChain = (g) => { const f = loop(62, 100, .78); g.add(tube('chain', f, 600, .4, true, chainMat, 6)); return f(0); };
  const A = 32, B = 26;
  const ell = (rr = 0) => (t) => { const a = t * TAU; return V((A + rr) * Math.sin(a), 0, (B + rr) * Math.cos(a)); };
  const nrm = (t) => { const a = t * TAU; return V(Math.sin(a) / A, 0, Math.cos(a) / B).normalize(); };
  const clasp = (g, t = .5) => { const c = torus('clasp_ring', 1.6, .4, 32); c.position.copy(ell()(t)); g.add(c);
    const l = mesh('clasp_lobster', new THREE.CapsuleGeometry(1.1, 3.2, 6, 16), silver); l.position.copy(ell()(t - .03)).add(V(0, 0, -.6)); l.rotation.z = PI / 2; g.add(l); };
  const pair = (n, build) => { const g = grp(n); [-1, 1].forEach((s, i) => { const e = build(i ? 'right' : 'left'); e.position.x = s * 12; e.rotation.y = s * .25; g.add(e); }); return mm(g); };
  const post = (g, n, len = 10) => { const p = mesh(n + '_post', new THREE.CylinderGeometry(.4, .4, len, 12), silver); p.rotation.x = PI / 2; p.position.z = -len / 2; g.add(p);
    const b = mesh(n + '_butterfly', new THREE.CylinderGeometry(2.6, 2.6, .8, 32), silver); b.rotation.x = PI / 2; b.position.z = -len * .7; g.add(b); };

  const pin = (g, n, len) => { const p = mesh(n + '_ear_pin', new THREE.CylinderGeometry(.4, .4, len, 12), silver); p.rotation.x = PI / 2; p.position.z = -len / 2; g.add(p);
    const tip = mesh(n + '_ear_pin_tip', new THREE.SphereGeometry(.4, 12, 8), silver); tip.position.z = -len; g.add(tip); };
  // Butterfly (friction) back: disc with two curled wings gripping the pin
  const clutch = (g, n, z) => {
    const d = mesh(n + '_clutch_disc', new THREE.CylinderGeometry(2.8, 2.8, .45, 40), silver); d.rotation.x = PI / 2; d.position.z = z; g.add(d);
    const hub = mesh(n + '_clutch_hub', new THREE.CylinderGeometry(.75, .75, 1.6, 20), silver); hub.rotation.x = PI / 2; hub.position.z = z - .5; g.add(hub);
    [-1, 1].forEach((sx, i) => { const w = mesh(`${n}_clutch_wing${i + 1}`, new THREE.TorusGeometry(.9, .32, 12, 32, PI * 1.25), silver);
      w.position.set(sx * 1.05, 0, z + .75); w.rotation.set(0, sx > 0 ? PI / 2 : -PI / 2, PI * .5); g.add(w); });
  };
  // Claw head (stone table up). Each claw: tip over crown → girdle → caller-supplied path down into the metal.
  const claws = (name, r, pos, n, path, { gallery = true, phase = 0 } = {}) => {
    const g = grp(name); g.position.copy(pos); g.add(stone(name + '_stone', r));
    const tr = Math.max(.28, .13 * r);
    for (let i = 0; i < n; i++) {
      const a = phase + i / n * TAU, d = V(Math.cos(a), 0, Math.sin(a));
      const pts = [d.clone().multiplyScalar(.8 * r).add(V(0, .32 * r, 0)), d.clone().multiplyScalar(1.04 * r).add(V(0, .08 * r, 0)), d.clone().multiplyScalar(1.03 * r).add(V(0, -.2 * r, 0)), ...path(a, d)];
      const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      g.add(tube(`${name}_claw${i + 1}`, (t) => c.getPoint(t), 64, tr, false, silver, 12));
      g.add(bead(`${name}_claw${i + 1}_tip`, tr * 1.05, pts[0]));
    }
    if (gallery) { const gl = torus(name + '_gallery', .86 * r, tr * .8, 64); gl.rotation.x = PI / 2; gl.position.y = -.5 * r; g.add(gl); }
    return g;
  };
  // Rub-over bezel cup: stone sits in a closed collar; collar oriented along normal
  const bezel = (name, r, pos, normal) => {
    const g = grp(name); g.add(stone(name + '_stone', r));
    const rim = torus(name + '_bezel_rim', r * 1.03, .26, 48); rim.rotation.x = PI / 2; rim.position.y = .02; g.add(rim);
    const cup = mesh(name + '_bezel_cup', new THREE.CylinderGeometry(r * 1.03 + .26, r * .55, r * 1.15, 40), silver); cup.position.y = -r * .575 - .05; g.add(cup);
    g.position.copy(pos); g.quaternion.setFromUnitVectors(UP, normal.clone().normalize()); return g;
  };
  // Variable-radius sweep (one continuous surface), radius given by arc distance from each end
  const sweep = (name, curve, radiusAt, segs = 400, radial = 32) => {
    const fr = curve.computeFrenetFrames(segs, false), L = curve.getLength(), pos = [], idx = [], P = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, c = curve.getPointAt(u), r = radiusAt(u * L, (1 - u) * L);
      for (let k = 0; k < radial; k++) { const th = k / radial * TAU; n.copy(fr.normals[i]).multiplyScalar(Math.cos(th)).addScaledVector(fr.binormals[i], Math.sin(th)); P.copy(c).addScaledVector(n, r); pos.push(P.x, P.y, P.z); }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) { const a = i * radial + k, b = i * radial + (k + 1) % radial, c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(name, geo, silverDS);
  };
  const smax = (a, b, k) => k * Math.log(Math.exp(a / k) + Math.exp(b / k));
  const hingedHoop = (g, n, r, t, gapDeg, pinR) => {
    const gap = gapDeg * PI / 180, a0 = PI / 2 + gap, a1 = PI / 2 + TAU - gap, at = (a) => V(r * Math.cos(a), r * Math.sin(a), 0);
    g.add(tube(n + '_hoop', (u) => at(a0 + u * (a1 - a0)), 200, t, false, silver, 24));
    [a0, a1].forEach((a, i) => g.add(bead(`${n}_hoop_end${i + 1}`, t, at(a))));
    // ear pin: thin wire from one end across the gap into the other
    g.add(tube(n + '_ear_pin', (u) => at(a1 - .05 + u * (2 * gap + .1)), 40, pinR, false, silver, 12));
  };
  return [
    // ── Cincin ──
    { cat: 'Cincin', name: 'Cincin Solitaire', file: 'cincin-solitaire', fn() {
      const g = grp('solitaire_ring'); g.add(torus('band', R, .85));
      const cy = R + 3.1, top = R + .45 - cy;
      g.add(claws('solitaire', 3, V(0, cy, 0), 6, (a, d) => [V(2.3 * d.x, -1.5, 2.3 * d.z), V(1.1 * d.x, top + .6, .7 * d.z), V(.55 * d.x, top, .35 * d.z)]));
      const seat = mesh('solitaire_seat', new THREE.CylinderGeometry(1.2, .9, 1.0, 32), silver); seat.position.y = R + .7; g.add(seat);
      return mm(g); } },
    { cat: 'Cincin', name: 'Cincin Eternity', file: 'cincin-eternity', fn() {
      const g = grp('eternity_ring'); const core = torus('core', R + .1, .6); core.scale.z = 2.0; g.add(core); const N = 26;
      [-1, 1].forEach((sz, i) => { const rl = torus(`channel_rail${i + 1}`, R + .85, .38); rl.position.z = sz * 1.08; g.add(rl); });
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, n = V(Math.sin(a), Math.cos(a), 0); g.add(setStone(`stone${i + 1}`, .98, n.clone().multiplyScalar(R + 1.0), n));
        const b = (i + .5) / N * TAU, m = V(Math.sin(b), Math.cos(b), 0).multiplyScalar(R + 1.25);
        [-1, 1].forEach((sz, j) => g.add(bead(`shared_bead${i + 1}_${j + 1}`, .36, m.clone().add(V(0, 0, sz * .82)))));
      }
      return mm(g); } },
    { cat: 'Cincin', name: 'Cincin Halo', file: 'cincin-halo', fn() {
      const g = grp('halo_ring'); const hb = torus('band', R, .75); hb.scale.z = 1.25; g.add(hb);
      const head = mesh('halo_basket', new THREE.CylinderGeometry(3.3, 1.0, 1.75, 48, 1, true), silverDS); head.position.y = R + 1.05; g.add(head);
      const rim = torus('halo_rim', 3.3, .55, 64); rim.rotation.x = PI / 2; rim.position.y = R + 1.9; g.add(rim);
      const inner = torus('basket_inner_rim', 2.05, .32, 64); inner.rotation.x = PI / 2; inner.position.y = R + 1.75; g.add(inner);
      g.add(claws('centre', 2.2, V(0, R + 2.75, 0), 4, (a, d) => [V(2.1 * d.x, -.95, 2.1 * d.z), V(2.05 * d.x, -1.05, 2.05 * d.z)], { gallery: false, phase: PI / 4 }));
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.add(setStone(`halo${i + 1}`, .6, V(3.3 * Math.cos(a), R + 2.55, 3.3 * Math.sin(a)), UP)); }
      // half-eternity: stones down both shoulders to the band's midline (50% of the ring)
      for (let k = 0; k < 11; k++) { const ang = .36 + k * .118; [-1, 1].forEach((sd) => { const al = sd * ang, nn = V(Math.sin(al), Math.cos(al), 0);
        g.add(setStone(`shoulder_${sd > 0 ? 'r' : 'l'}${k + 1}`, .5, nn.clone().multiplyScalar(R + .95), nn));
        [-1, 1].forEach((sz, j) => { if (k < 10) { const b2 = al + sd * .059, m = V(Math.sin(b2), Math.cos(b2), 0).multiplyScalar(R + .85); g.add(bead(`shoulder_bead_${sd > 0 ? 'r' : 'l'}${k + 1}_${j + 1}`, .26, m.add(V(0, 0, sz * .45)))); } }); }); }
      return mm(g); } },
    { cat: 'Cincin', name: 'Cincin Pilin', file: 'cincin-pilin', fn() {
      const g = grp('twist_ring');
      [0, PI].forEach((ph, i) => g.add(tube(`strand${i + 1}`, (t) => { const a = t * TAU, r = R + .55 * Math.cos(8 * a + ph); return V(r * Math.sin(a), r * Math.cos(a), .55 * Math.sin(8 * a + ph)); }, 640, .55, true, silver, 16)));
      return mm(g); } },
    { cat: 'Cincin', name: 'Cincin Terbuka', file: 'cincin-terbuka', note: 'Bypass ring: kawat bulat polos melingkar satu putaran; ujung satu berbatu bezel, ujung lain bola perak, saling bersebelahan di atas jari.', fn() {
      const g = grp('bypass_ring'), w = .72, zo = 1.55;
      const at = (a, r = R) => V(r * Math.sin(a), r * Math.cos(a), zo * Math.cos(a / 2));
      const rs = 1.25, sc = at(0, R + w + 1.12), n = V(0, 1, 0), bc = at(TAU, R + w + .62);
      const pts = [sc.clone().add(V(0, -1.1, 0)), at(.18, R + .35)]; for (let i = 1; i < 60; i++) pts.push(at(.3 + i / 60 * (TAU - .6))); pts.push(at(TAU - .18, R + .3), bc.clone());
      const bandC = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      g.add(tube('band', (t) => bandC.getPoint(t), 480, w, false, silver, 28));
      g.add(bead('band_cap1', w, pts[0]), bead('band_cap2', w, pts[pts.length - 1]));
      g.add(bezel('bezel', rs, sc, n));
      const ball = mesh('ball', new THREE.SphereGeometry(1.32, 48, 32), silver); ball.position.copy(bc); g.add(ball);
      return mm(g); } },
    { cat: 'Cincin', name: 'Cincin Bypass Pavé', file: 'cincin-bypass-pave', note: 'Open bypass ring: satu ujung ring naik ke solitaire 4 cakar, ujung lainnya pita pavé berlian kecil yang menyilang di sampingnya.', fn() {
      const g = grp('bypass_pave_ring'), w = 1.7, th = 1.25, A1 = TAU + .85, Rc = R + th / 2;
      const zAt = (a) => -1.55 + 2.9 * a / A1, nA = (a) => V(Math.sin(a), Math.cos(a), 0), pA = (a) => nA(a).multiplyScalar(Rc).add(V(0, 0, zAt(a)));
      const a0 = -.55, S = 560, M = 32, pos = [], idx = [];
      for (let i = 0; i <= S; i++) { const a = a0 + (A1 - a0) * i / S, f = Math.max(.06, Math.sqrt(Math.min(1, (A1 - a) / .4, (a - a0) / .35))), p = pA(a), n = nA(a);
        for (let k = 0; k < M; k++) { const t = k / M * TAU, c = Math.cos(t), s = Math.sin(t), x = w * f / 2 * Math.sign(c) * Math.pow(Math.abs(c), .45), y = th * Math.min(1, f * 1.4) / 2 * Math.sign(s) * Math.pow(Math.abs(s), .6);
          pos.push(p.x + n.x * y, p.y + n.y * y, p.z + x); } }
      for (let i = 0; i < S; i++) for (let k = 0; k < M; k++) { const a = i * M + k, b = i * M + (k + 1) % M, c = a + M, d = b + M; idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(mesh('band', geo, silverDS));
      // solitaire head on the inner end
      const r = 2.85, top = R + th - .15, cy = R + th + r * 1.0, hz = zAt(0);
      g.add(claws('head', r, V(0, cy, hz), 4, (a, d) => [d.clone().multiplyScalar(.9 * r).add(V(0, -.48 * r, 0)), d.clone().multiplyScalar(.8 * r).add(V(0, -.66 * r, 0))], { phase: PI / 4 }));
      const gl2 = torus('head_gallery_low', .8 * r, .13 * r * .8, 48); gl2.rotation.x = PI / 2; gl2.position.set(0, cy - .66 * r, hz); g.add(gl2);
      // split shank: two short swept supports rising from the band into the gallery
      [-1, 1].forEach((sd) => { const c = new THREE.CatmullRomCurve3([pA(sd * .3).addScaledVector(nA(sd * .3), th / 2 - .4), V(sd * .92 * r, R + th + .05, hz), V(sd * .8 * r, cy - .66 * r, hz)], false, 'centripetal');
        g.add(tube('head_support_' + (sd > 0 ? 'r' : 'l'), (t) => c.getPoint(t), 64, .13 * r * .8, false, silver, 16)); });
      // pavé line on the outer end
      const pr = .36, da = (2 * pr + .1) / (R + th);
      [[TAU - 1.7, A1 - .35, 'pave_'], [.42, 1.75, 'pave_inner_']].forEach(([aS, aE, pfx]) => {
      for (let a = aS, k = 1; a < aE; a += da, k++) { const n = nA(a), p = pA(a).addScaledVector(n, th / 2 + .04);
        const st = stone(pfx + k, pr); st.position.copy(p); st.quaternion.setFromUnitVectors(UP, n); g.add(st);
        const seat = mesh(pfx + k + '_seat', new THREE.TorusGeometry(pr * 1.02, .05, 8, 32), silver); seat.position.copy(p).addScaledVector(n, -.03); seat.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(seat);
        [-1, 1].forEach((sd) => [-1, 1].forEach((sa) => { const q = a + sa * da * .5; g.add(bead(`${pfx}${k}_grain_${sd > 0 ? 'b' : 'a'}${sa > 0 ? 2 : 1}`, .095, pA(q).addScaledVector(nA(q), th / 2 + .06).add(V(0, 0, sd * pr * .72)))); })); } });
      return mm(g); } },
    // ── Kalung ──
    { cat: 'Kalung', name: 'Kalung Solitaire', file: 'kalung-solitaire', fn() {
      const g = grp('solitaire_necklace'), p = neckChain(g);
      g.add(pendantStone('pendant', 2.6, p).g); return mm(g); } },
    { cat: 'Kalung', name: 'Kalung Bar', file: 'kalung-bar', fn() {
      // curved bar that follows the neckline; joined to the chain by a jump ring at each end
      const g = grp('bar_necklace'), f = loop(62, 100, .78), tAt = (x) => Math.asin(x / 62) / TAU;
      const tb = tAt(12), tr = tAt(12.6), tc = tAt(13.25), br = 1.15;
      g.add(tube('chain', (t) => f(tc + t * (1 - 2 * tc)), 600, .4, false, chainMat, 6));
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => f(-tb + i / 24 * 2 * tb)));
      g.add(sweep('bar', curve, (s0, s1) => { const s = Math.min(s0, s1); return s < br ? Math.sqrt(Math.max(.0004, br * br - (br - s) ** 2)) : br; }, 200, 40));
      const out = (t) => { const a = t * TAU; return V(Math.sin(a), 0, Math.cos(a)); };
      [-1, 1].forEach((sd, i) => { const t = sd * tr, ring = torus(`jump_ring${i + 1}`, .72, .24, 32); ring.position.copy(f(t)); ring.quaternion.setFromUnitVectors(V(0, 0, 1), out(t)); g.add(ring); });
      for (let i = 0; i < 7; i++) { const t = -tb * .78 + i / 6 * tb * 1.56; g.add(setStone(`bar_stone${i + 1}`, .8, f(t).addScaledVector(out(t), br + .05), out(t))); }
      return mm(g); } },
    { cat: 'Kalung', name: 'Kalung Lingkar', file: 'kalung-lingkar', fn() {
      const g = grp('circle_necklace'), p = neckChain(g), r = 7, tw = .7;
      const bl = torus('bale', 1.1, .3, 32); bl.position.copy(p); bl.rotation.y = PI / 2; g.add(bl);
      const cy = p.y - 1.1 - r - tw + .45, cz = p.z;
      const c = torus('circle', r, tw, 128); c.position.set(0, cy, cz); g.add(c);
      for (let i = 0; i < 18; i++) { const a = PI / 2 + (i + .5) / 18 * TAU; g.add(setStone(`circle_stone${i + 1}`, .82, V(r * Math.cos(a), cy + r * Math.sin(a), cz + .7), V(0, 0, 1))); }
      return mm(g); } },
    { cat: 'Kalung', name: 'Kalung Station', file: 'kalung-station', fn() {
      // stations threaded on the chain: the chain runs through each bezel's two side collars
      const g = grp('station_necklace'), f = loop(62, 100, .78); g.add(tube('chain', f, 600, .4, true, chainMat, 6));
      [-.15, -.1, -.05, 0, .05, .1, .15].forEach((t, i) => {
        const a = t * TAU, nv = V(Math.sin(a), 0, Math.cos(a)), tg = f(t + .001).sub(f(t - .001)).normalize(), r = 1.3, p = f(t), sg = grp(`station${i + 1}`);
        sg.add(bezel(`station${i + 1}_bezel`, r, p.clone().addScaledVector(nv, .75), nv));
        [-1, 1].forEach((sd, j) => { const col = mesh(`station${i + 1}_collar${j + 1}`, new THREE.CylinderGeometry(.62, .62, 1.0, 20), silver);
          col.position.copy(p).addScaledVector(tg, sd * (r * 1.03 + .5)); col.quaternion.setFromUnitVectors(UP, tg); sg.add(col); });
        g.add(sg);
      });
      return mm(g); } },
    { cat: 'Kalung', name: 'Kalung Hati', file: 'kalung-hati', fn() {
      const g = grp('heart_necklace'), p = neckChain(g), hf = heart(.5, 0, p.y - 2.4, p.z + .6);
      g.add(bale('bale', V(0, p.y - 1.1, p.z + .3)));
      g.add(tube('heart_wire', hf, 300, .45, true));
      spaced(hf, .02, .98, 1.5).forEach((t, i) => g.add(bead(`heart_bead${i + 1}`, .6, hf(t).add(V(0, 0, .45)))));
      return mm(g); } },
    { cat: 'Kalung', name: 'Kalung Tiga Batu', file: 'kalung-tiga-batu', fn() {
      // three graduated stones linked loop-to-loop
      const g = grp('three_stone_necklace'), p = neckChain(g);
      const a = pendantStone('stone_small', 1.3, p, { bottom: true }); g.add(a.g);
      const t2 = a.bottomPt.clone(); t2.y -= LOOP - LT - .05; const b = pendantStone('stone_medium', 1.75, t2, { bottom: true }); g.add(b.g);
      const t3 = b.bottomPt.clone(); t3.y -= LOOP - LT - .05; g.add(pendantStone('stone_large', 2.3, t3).g);
      return mm(g); } },
    // ── Gelang ──
    { cat: 'Gelang', name: 'Gelang Tennis', file: 'gelang-tennis', fn() {
      const g = grp('tennis_bracelet'), f = ell(); g.add(tube('rail', ell(-.7), 500, .45, true, chainMat, 6));
      spaced(f, 0, .985, 2.9).forEach((t, i) => g.add(setStone(`stone${i + 1}`, 1.25, f(t).add(nrm(t).multiplyScalar(.6)), nrm(t))));
      return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Cuff', file: 'gelang-cuff', fn() {
      const g = grp('cuff_bracelet'), f = ell(), t0 = .54, t1 = 1.46;
      const c = tube('cuff', (t) => f(t0 + t * (t1 - t0)), 400, 1.5, false, silver, 24); c.scale.y = 2.4; g.add(c);
      [t0, t1].forEach((t, i) => g.add(setStone(`end_stone${i + 1}`, 1.8, f(t).add(nrm(t).multiplyScalar(1.6)), nrm(t), 4)));
      return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Bola', file: 'gelang-bola', fn() {
      const g = grp('bead_bracelet'), f = ell(); g.add(tube('chain', f, 500, .42, true, chainMat, 6));
      spaced(f, .04, .96, 9).forEach((t, i) => g.add(bead(`ball${i + 1}`, 1.9, f(t))));
      clasp(g); return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Charm Hati', file: 'gelang-charm-hati', fn() {
      const g = grp('heart_charm_bracelet'), f = ell(); g.add(tube('chain', f, 500, .42, true, chainMat, 6));
      const p = f(0); const jr = torus('jump_ring', 1.0, .3, 32); jr.position.set(0, -1, p.z); jr.rotation.y = PI / 2; g.add(jr);
      const hf = heart(.36, 0, -2.2, p.z + .2); g.add(tube('heart_wire', hf, 300, .4, true));
      spaced(hf, .02, .98, 1.3).forEach((t, i) => g.add(bead(`heart_bead${i + 1}`, .5, hf(t).add(V(0, 0, .4)))));
      clasp(g); return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Infinity', file: 'gelang-infinity', fn() {
      const g = grp('infinity_bracelet'), f = ell(), w = 14, ta = Math.asin(w / A) / TAU;
      g.add(tube('chain', (t) => f(ta + t * (1 - 2 * ta)), 500, .42, false, chainMat, 6));
      const lem = (t) => { const s = t * TAU, d = 1 + Math.sin(s) ** 2, x = w * Math.cos(s) / d; return V(x, 1.4 * w * Math.sin(s) * Math.cos(s) / d * .9, B * Math.sqrt(1 - (x / A) ** 2) + .6); };
      g.add(tube('infinity', lem, 400, .55, true, silver, 16));
      spaced(lem, .76, 1.24, 1.5, 800).forEach((t, i) => g.add(bead(`infinity_bead${i + 1}`, .6, lem(t % 1).add(V(0, 0, .5)))));
      clasp(g); return mm(g); } },
    // ── Anting ──
    { cat: 'Anting', name: 'Anting Stud', file: 'anting-stud', fn() {
      return pair('stud_earrings', (s) => { const e = grp('stud_' + s); e.add(setStone('stone_' + s, 2.6, V(0, 0, 0), V(0, 0, 1))); pin(e, s, 11); clutch(e, s, -7); return e; }); } },
    { cat: 'Anting', name: 'Anting Hoop', file: 'anting-hoop', fn() {
      return pair('hoop_earrings', (s) => { const e = grp('hoop_' + s), r = 8; hingedHoop(e, s, r, .8, 18, .32);
        for (let i = 0; i < 20; i++) { const a = (-195 + i * 11) * PI / 180; e.add(bead(`hoop_${s}_bead${i + 1}`, .62, V((r + .75) * Math.cos(a), (r + .75) * Math.sin(a), 0))); }
        return e; }); } },
    { cat: 'Anting', name: 'Anting Huggie', file: 'anting-huggie', fn() {
      return pair('huggie_earrings', (s) => { const e = grp('huggie_' + s), r = 5.5; hingedHoop(e, s, r, 1.3, 24, .38);
        for (let i = 0; i < 7; i++) { const a = (-165 + i * 25) * PI / 180; e.add(setStone(`huggie_${s}_stone${i + 1}`, .9, V(r * Math.cos(a), r * Math.sin(a), 1.4), V(0, 0, 1))); }
        return e; }); } },
    { cat: 'Anting', name: 'Anting Drop', file: 'anting-drop', fn() {
      return pair('drop_earrings', (s) => { const e = grp('drop_' + s);
        e.add(setStone('top_' + s, 1.8, V(0, 0, 0), V(0, 0, 1))); pin(e, s, 10); clutch(e, s, -6.5);
        const frame = torus('top_bezel_frame_' + s, 1.95, .32, 48); frame.position.z = -.15; e.add(frame);
        const loopTop = torus('top_loop_' + s, .6, .24, 32); loopTop.position.set(0, -2.75, -.15); loopTop.rotation.y = PI / 2; e.add(loopTop);
        let y = -3.15; const n = 12;
        for (let i = 0; i < n; i++) { const l = mesh(`link_${s}${i + 1}`, new THREE.TorusGeometry(.62, .2, 10, 24), chainMat); l.scale.y = 1.35; l.position.set(0, y - .62, -.4); if (i % 2) l.rotation.y = PI / 2; e.add(l); y -= 1.15; }
        const jr = torus('drop_jump_ring_' + s, .75, .25, 32); jr.position.set(0, y - .6, -.4); e.add(jr);
        const tipY = y - 1.3, w = 3.6, ht = 5.6, cy = tipY - ht;
        const td = teardrop(w, ht, 0, cy, -.4); e.add(tube('teardrop_' + s, td, 200, .4, true));
        spaced(td, .04, .96, 1.25).forEach((t, i) => e.add(bead(`teardrop_${s}_bead${i + 1}`, .52, td(t).add(V(0, 0, .4)))));
        e.add(setStone('teardrop_stone_' + s, 1.4, V(0, cy - ht + 2.1, -.2), V(0, 0, 1)));
        return e; }); } },
    { cat: 'Anting', name: 'Anting Kait', file: 'anting-kait', fn() {
      return pair('hook_earrings', (s) => { const e = grp('hook_' + s);
        const hc = new THREE.CatmullRomCurve3([V(0, -2, .3), V(0, 2, .3), V(0, 4.4, -.7), V(0, 5, -2.4), V(0, 4.2, -4), V(0, 2, -4.5), V(0, -.8, -4.6)]);
        e.add(tube('hook_' + s, (t) => hc.getPoint(t), 160, .4, false, silver, 12));
        const r = 4.2, c = torus('ring_' + s, r, .5, 64); c.position.set(0, -2.4 - r, .3); e.add(c);
        e.add(setStone('ring_stone_' + s, 1.5, V(0, -2.4 - r, 1.1), V(0, 0, 1)));
        [-1, 1].forEach((d, i) => { const bar = mesh(`ring_bar_${s}${i + 1}`, new THREE.CylinderGeometry(.3, .3, r - 1.6, 8), silver); bar.position.set(0, -2.4 - r + d * (r / 2 + .7), .3); e.add(bar); });
        return e; }); } },
  ];
}
