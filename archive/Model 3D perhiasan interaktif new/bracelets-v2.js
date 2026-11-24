// Refined bracelets: real band sections, collet / box / flush settings, pavé rails.
export function buildBracelets(THREE, h) {
  const { silver, chainMat, tube, bead, stone, setStone, spaced, mesh, mm, V, UP } = h;
  const silverDS = silver.clone(); silverDS.side = THREE.DoubleSide;
  const PI = Math.PI, TAU = PI * 2, A = 32, B = 26;
  const grp = (n) => { const g = new THREE.Group(); g.name = n; return g; };
  const torus = (n, r, t, rs = 48) => mesh(n, new THREE.TorusGeometry(r, t, 16, rs), silver);
  const ell = (rr = 0) => (t) => { const a = t * TAU; return V((A + rr) * Math.sin(a), 0, (B + rr) * Math.cos(a)); };
  const nrmAt = (t) => { const a = t * TAU; return V(Math.sin(a) / A, 0, Math.cos(a) / B).normalize(); };
  const tanAt = (t) => ell()(t + 1e-4).sub(ell()(t - 1e-4)).normalize();
  const orient = (o, n, tg) => { const z = new THREE.Vector3().crossVectors(tg, n).normalize(); o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tg.clone().normalize(), n.clone().normalize(), z)); };
  const ARC = (() => { const s = [0]; let p = ell()(0); for (let i = 1; i <= 4000; i++) { const q = ell()(i / 4000); s.push(s[i - 1] + q.distanceTo(p)); p = q; } return s; })();
  const L = ARC[4000];
  // t at arc length s from the front (t=0); s may be negative or > L
  const tAt = (s) => { s = ((s % L) + L) % L; let lo = 0, hi = 4000; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARC[m] < s) lo = m; else hi = m; } return (lo + (s - ARC[lo]) / (ARC[hi] - ARC[lo])) / 4000; };

  // Band with ring cross-section (domed outside, comfort inside). Open bands get rounded ends.
  function band(name, path, segs, w, hOut, hIn, { closed = true, endLen = 0 } = {}) {
    const K = 16, pos = [], idx = [], T = new THREE.Vector3(), Bn = new THREE.Vector3(), P = new THREE.Vector3(), prof = [];
    for (let k = 0; k <= K; k++) { const v = -1 + 2 * k / K; prof.push([v, hOut * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), 4)), .25)]); }
    for (let k = K - 1; k >= 1; k--) { const v = -1 + 2 * k / K; prof.push([v * .97, -hIn * (.82 + .18 * (1 - v * v))]); }
    const M = prof.length, rings = closed ? segs : segs + 1;
    let len = 0; if (!closed) { let p = path(0).p; for (let i = 1; i <= 400; i++) { const q = path(i / 400).p; len += q.distanceTo(p); p = q; } }
    for (let i = 0; i < rings; i++) {
      const u = i / segs, { p, n } = path(u);
      T.copy(path(Math.min(1, u + 1e-4)).p).sub(path(Math.max(0, u - 1e-4)).p).normalize(); Bn.crossVectors(T, n).normalize();
      let f = 1; if (!closed && endLen) { const d = Math.min(u, 1 - u) * len; if (d < endLen) f = Math.sqrt(Math.max(0, 1 - (1 - d / endLen) ** 2)); }
      const c = closed || !endLen ? p : p;
      for (const [v, o] of prof) { P.copy(c).addScaledVector(Bn, v * w / 2 * Math.max(f, .02)).addScaledVector(n, o * Math.max(f, .02)); pos.push(P.x, P.y, P.z); }
    }
    const last = closed ? rings : rings - 1;
    for (let i = 0; i < last; i++) for (let k = 0; k < M; k++) {
      const a = i * M + k, b = i * M + (k + 1) % M, c = ((i + 1) % rings) * M + k, d = ((i + 1) % rings) * M + (k + 1) % M;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(name, geo, silverDS);
  }
  // Pavé along a rail: flush stones, bright-cut seat, shared beads both sides
  function pave(g, name, path, us, r, hOut, beadOff, skip = () => false) {
    const T = new THREE.Vector3(), Bn = new THREE.Vector3();
    const frame = (u) => { const { p, n } = path(u); T.copy(path(u + 1e-4).p).sub(path(u - 1e-4).p).normalize(); Bn.crossVectors(T, n).normalize(); return { p, n, b: Bn.clone() }; };
    const kept = us.filter(u => !skip(u)), step = us[1] - us[0];
    kept.forEach((u, i) => {
      const { p, n } = frame(u), c = p.clone().addScaledVector(n, hOut + .02);
      const s = stone(name + '_stone' + (i + 1), r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
      const seat = mesh(name + '_seat' + (i + 1), new THREE.TorusGeometry(r * 1.02, .07, 8, 32), silver); seat.position.copy(c).addScaledVector(n, -.03); seat.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(seat);
      [-.5, .5].forEach((o, k) => { const { p: bp, n: bn, b } = frame(u + o * step);
        [-1, 1].forEach((sd, j) => g.add(bead(name + '_bead' + (i + 1) + '_' + k + j, r * .34, bp.clone().addScaledVector(bn, hOut * .85 + r * .12).addScaledVector(b, sd * beadOff)))); });
    });
  }
  // Round collet: cup + lip, stone table along n
  function collet(g, name, r, c, n) {
    const s = stone(name + '_stone', r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
    const cup = mesh(name + '_collet', new THREE.CylinderGeometry(r * 1.04 + .12, r * .6, r * 1.05, 40), silver); cup.position.copy(c).addScaledVector(n, -r * .55); cup.quaternion.setFromUnitVectors(UP, n); g.add(cup);
    const lip = mesh(name + '_lip', new THREE.TorusGeometry(r * 1.04 + .08, .12, 10, 48), silver); lip.position.copy(c).addScaledVector(n, -.02); lip.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(lip);
  }
  const lobster = (g, t) => {
    const p = ell()(t), n = nrmAt(t), tg = tanAt(t);
    const ring = torus('clasp_ring', 1.5, .38); ring.position.copy(p); orient(ring, n, tg); ring.rotateX(PI / 2); g.add(ring);
    const body = mesh('clasp_lobster', new THREE.CapsuleGeometry(1.15, 3.4, 8, 20), silver); body.position.copy(ell()(t - 3.4 / L)); orient(body, n, tg); body.rotateZ(PI / 2); g.add(body);
  };
  const ellPath = (rr = 0) => (u) => ({ p: ell(rr)(u), n: nrmAt(u) });
  // stone sunk into the band face: collet hidden in the metal, polished lip at the surface
  function flushCollet(g, name, r, c, n) {
    const s = stone(name + '_stone', r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
    const lip = mesh(name + '_lip', new THREE.TorusGeometry(r * 1.04 + .06, .13, 10, 48), silver); lip.position.copy(c).addScaledVector(n, -.03); lip.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(lip);
    const cup = mesh(name + '_collet', new THREE.CylinderGeometry(r * 1.04 + .1, r * .6, r * 1.05, 40), silver); cup.position.copy(c).addScaledVector(n, -r * .56); cup.quaternion.setFromUnitVectors(UP, n); g.add(cup);
  }
  // Two-piece hinged bangle: knuckle hinge on the left (t=.75), box catch on the right (t=.25)
  function splitBangle(g, name, w, hO, hIn) {
    const gapF = .9, gapH = .35, sC = L / 4, sH = 3 * L / 4, mid = (hO - hIn) / 2, T = (s) => tAt(s);
    const seg = (n, s0, s1) => { const d = s1 - s0; return band(n, (u) => ellPath()(unwrap(s0 + u * d)), 300, w, hO, hIn, { closed: false, endLen: .35 }); };
    const unwrap = (s) => { const t = T(s); return t; };
    g.add(seg(name + '_front', sH - L + gapH / 2, sC - gapF / 2), seg(name + '_back', sC + gapF / 2, sH - gapH / 2));
    const frameAt = (s) => { const t = T(s), n = nrmAt(t), tg = tanAt(t); return { p: ell()(t), n, tg, b: new THREE.Vector3().crossVectors(tg, n).normalize() }; };
    // box catch housing, fixed to the back piece
    const c0 = frameAt(sC + 2.2), hz = hO + hIn + .5;
    const housing = mesh('catch_box', new THREE.BoxGeometry(4.4, hz, w + .5), silver); housing.position.copy(c0.p).addScaledVector(c0.n, mid); orient(housing, c0.n, c0.tg); g.add(housing);
    [1].forEach((sd, i) => { const e = mesh('catch_box_edge' + (i + 1), new THREE.CylinderGeometry(hz / 2, hz / 2, w + .5, 24), silver); e.position.copy(frameAt(sC + 2.2 + sd * 2.2).p).addScaledVector(c0.n, mid); orient(e, c0.n, c0.tg); e.rotateX(PI / 2); g.add(e); });
    // spring tongue on the front piece, sliding into the box through the slot
    const t0 = frameAt(sC + .4), tongue = mesh('catch_tongue', new THREE.BoxGeometry(3.4, .4, w - .9), silver);
    tongue.position.copy(t0.p).addScaledVector(t0.n, mid); orient(tongue, t0.n, t0.tg); g.add(tongue);
    const slot = mesh('catch_slot', new THREE.BoxGeometry(.06, .55, w - .7), new THREE.MeshStandardMaterial({ name: 'slot_shadow', color: 0x0b0d10, roughness: .9 }));
    slot.position.copy(frameAt(sC + .01).p).addScaledVector(c0.n, mid); orient(slot, c0.n, c0.tg); g.add(slot);
    // push button on the outer face
    const btn = mesh('catch_push_button', new THREE.CylinderGeometry(.8, .8, .55, 32), silver); btn.position.copy(c0.p).addScaledVector(c0.n, mid + hz / 2 + .25); btn.quaternion.setFromUnitVectors(UP, c0.n); g.add(btn);
    const ring = mesh('catch_button_ring', new THREE.TorusGeometry(.95, .1, 8, 40), silver); ring.position.copy(c0.p).addScaledVector(c0.n, mid + hz / 2 + .02); ring.quaternion.setFromUnitVectors(V(0, 0, 1), c0.n); g.add(ring);
    // figure-8 safety on the upper side: loops over a peg on each piece
    const pa = frameAt(sC + 2.4), pb = frameAt(sC - 2.0), side = (fr) => fr.p.clone().addScaledVector(fr.b, -(w / 2 + .3)).addScaledVector(fr.n, mid);
    const pegA = side(pa), pegB = side(pb);
    g.add(bead('safety_peg_box', .35, pegA), bead('safety_peg_band', .35, pegB));
    const s8 = mesh('safety_figure8', new THREE.TorusGeometry(.5, .14, 10, 40), silver); s8.scale.set(5.2, 1, 1); s8.position.copy(pegA).lerp(pegB, .5).addScaledVector(pa.b, -.12);
    s8.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(pa.tg, pa.n, pa.b)); g.add(s8);
    // knuckle hinge: three alternating knuckles on a pin
    const hf = frameAt(sH), kr = .85, kh = (w - .2) / 3, kc = hf.p.clone().addScaledVector(hf.n, hO + .15);
    for (let k = 0; k < 3; k++) { const kn = mesh('hinge_knuckle' + (k + 1), new THREE.CylinderGeometry(kr, kr, kh - .06, 28), silver);
      kn.position.copy(kc).addScaledVector(hf.b, (k - 1) * kh); kn.quaternion.setFromUnitVectors(UP, hf.b); g.add(kn);
      const leaf = mesh('hinge_leaf' + (k + 1), new THREE.BoxGeometry(2.0, .5, kh - .06), silver); const lf = frameAt(sH + (k === 1 ? 1 : -1) * 1.0);
      leaf.position.copy(lf.p).addScaledVector(lf.n, hO - .05).addScaledVector(hf.b, (k - 1) * kh); orient(leaf, lf.n, lf.tg); g.add(leaf); }
    [-1, 1].forEach((sd, i) => g.add(bead('hinge_pin_cap' + (i + 1), .4, kc.clone().addScaledVector(hf.b, sd * (w / 2 + .05)))));
  }
  const heart = (s, cy, cz) => (t) => { const a = t * TAU; return V(s * 16 * Math.pow(Math.sin(a), 3), cy - 5 * s + s * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)), cz); };

  return [
    { cat: 'Gelang', name: 'Gelang Batu', file: 'gelang', note: 'Bangle berengsel. Buka lewat kunci kotak di sisi kanan: buka pengaman angka-8, tekan tombol, lalu tarik.', fn() {
      // wide hinged bangle; collets sunk into the band face, claw-set centre stone
      const g = grp('stone_bracelet'), f = ell(), w = 3.4, hO = .75, r = .95, rc = 1.45;
      splitBangle(g, 'bangle', w, hO, .65);
      const lift = (rr) => hO + .02;
      const sMax = 34, s0 = rc * 1.04 + .3 + r * 1.04 + .12;
      for (let s = s0, i = 0; s < sMax; s += 2.4, i++) [s, -s].forEach((ss, j) => { const t = tAt(ss), n = nrmAt(t);
        flushCollet(g, 'stone_' + (j ? 'l' : 'r') + (i + 1), r, f(t).addScaledVector(n, lift(r)), n); });
      const cn = nrmAt(0), cc = f(0).addScaledVector(cn, hO + .55);
      g.add(setStone('centre_stone', rc, cc, cn, 4));
      return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Tennis', file: 'gelang-tennis', note: 'Semua batu duduk di satu pita gelang. Buka lewat kunci kotak di sisi kanan.', fn() {
      // one continuous band carries every four-claw box; boxes sink into the band so only the claws show
      const g = grp('tennis_bracelet'), f = ell(), r = 1.15, w = 3.1, hO = .6, pitch = L / Math.round(L / 2.45);
      splitBangle(g, 'tennis_band', w, hO, .55);
      const sC = L / 4, sH = 3 * L / 4, clear = (s) => { const m = ((s % L) + L) % L; return Math.abs(m - sC) > 4.2 && Math.abs(m - sH) > 3.6; };
      let i = 0;
      for (let s = 0; s < L - pitch / 2 + 1e-6; s += pitch) { if (!clear(s)) continue; i++;
        const t = tAt(s), n = nrmAt(t), tg = tanAt(t), lk = grp('link' + i);
        const box = mesh('box' + i, new THREE.CylinderGeometry(r * 1.3, r * .95, r * 1.0, 4, 1), silver); box.position.set(0, -r * .55, 0); box.rotation.y = PI / 4; lk.add(box);
        lk.add(stone('stone' + i, r));
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], k) => {
          const cl = mesh('box' + i + '_claw' + (k + 1), new THREE.CylinderGeometry(.16, .22, r * .7, 8), silver); cl.position.set(sx * .78 * r, -.08 * r, sz * .78 * r); lk.add(cl);
          lk.add(bead('box' + i + '_claw_tip' + (k + 1), .23, V(sx * .74 * r, .28 * r, sz * .74 * r))); });
        lk.position.copy(f(t)).addScaledVector(n, hO + .08); orient(lk, n, tg); g.add(lk);
      }
      return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Cuff', file: 'gelang-cuff', fn() {
      // open cuff with rounded terminals; stones bezel-set flush into the cuff face
      const g = grp('cuff_bracelet'), t0 = .56, t1 = 1.44, path = (u) => ellPath()(t0 + u * (t1 - t0)), hO = 1.1;
      g.add(band('cuff', path, 360, 5.5, hO, .7, { closed: false, endLen: 2.6 }));
      const span = (t1 - t0) * L;
      [5 / span, 1 - 5 / span].forEach((u, i) => { const { p, n } = path(u), rs = 1.7, c = p.clone().addScaledVector(n, hO + .05);
        const s = stone('end_stone' + (i + 1), rs); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
        const lip = mesh('end_bezel' + (i + 1), new THREE.TorusGeometry(rs * 1.05, .28, 14, 56), silver); lip.position.copy(c).addScaledVector(n, -.05); lip.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(lip);
        const cup = mesh('end_bezel_cup' + (i + 1), new THREE.CylinderGeometry(rs * 1.05 + .2, rs * .7, 1.4, 48), silver); cup.position.copy(c).addScaledVector(n, -.75); cup.quaternion.setFromUnitVectors(UP, n); g.add(cup); });
      return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Bola', file: 'gelang-bola', fn() {
      // graduated polished beads threaded on the chain, each held by two crimp collars; clasp zone left clear
      const g = grp('bead_bracelet'), f = ell(); g.add(tube('chain', f, 500, .42, true, chainMat, 6));
      const step = 7, n = Math.floor((L - 26) / step);
      for (let i = 0; i < n; i++) {
        const s = (i - (n - 1) / 2) * step, t = tAt(s), big = i % 2 === 0, rb = big ? 1.9 : 1.25, p = f(t), tg = tanAt(t);
        g.add(bead('ball' + (i + 1), rb, p));
        [-1, 1].forEach((sd, j) => { const c = mesh('ball' + (i + 1) + '_crimp' + (j + 1), new THREE.CylinderGeometry(.62, .62, .9, 20), silver);
          c.position.copy(f(tAt(s + sd * (rb + .3)))); c.quaternion.setFromUnitVectors(UP, tg); g.add(c); });
      }
      lobster(g, .5); return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Charm Hati', file: 'gelang-charm-hati', fn() {
      // pavé heart rail hanging from a jump ring
      const g = grp('heart_charm_bracelet'), f = ell(); g.add(tube('chain', f, 500, .42, true, chainMat, 6));
      const p = f(0), jr = torus('jump_ring', 1.05, .3); jr.position.set(0, -1.0, p.z); jr.rotation.y = PI / 2; g.add(jr);
      const hf = heart(.4, -2.35, p.z + .1), hp = (u) => ({ p: hf(u), n: V(0, 0, 1) }), hO = .45;
      g.add(band('heart_rail', hp, 360, 1.3, hO, .45));
      const N = 28; pave(g, 'heart', hp, Array.from({ length: N }, (_, i) => (i + .5) / N), .48, hO, .55, (u) => u < .03 || u > .97);
      lobster(g, .5); return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Infinity', file: 'gelang-infinity', fn() {
      // pavé infinity rail wrapped on the wrist curve; chain joined by jump rings at its tips
      const g = grp('infinity_bracelet'), f = ell(), w = 14, ta = Math.asin((w + 1.6) / A) / TAU;
      g.add(tube('chain', (t) => f(ta + t * (1 - 2 * ta)), 500, .42, false, chainMat, 6));
      const lem = (t) => { const s = t * TAU, d = 1 + Math.sin(s) ** 2, x = w * Math.cos(s) / d; return V(x, 1.25 * w * Math.sin(s) * Math.cos(s) / d, B * Math.sqrt(1 - (x / A) ** 2) + .2); };
      const lp = (u) => { const p = lem(u), a = Math.asin(p.x / A); return { p, n: V(Math.sin(a) / A, 0, Math.cos(a) / B).normalize() }; };
      g.add(band('infinity_rail', lp, 480, 1.3, .45, .4));
      const N = 40; pave(g, 'infinity', lp, Array.from({ length: N }, (_, i) => (i + .5) / N), .46, .45, .54, (u) => Math.abs(lem(u).x) < 2.2);
      [-1, 1].forEach((sd, i) => { const t = sd * Math.asin((w + .8) / A) / TAU, jr = torus('jump_ring' + (i + 1), .75, .24); jr.position.copy(f(t)).setZ(f(t).z + .2); orient(jr, nrmAt(t), tanAt(t)); g.add(jr); });
      lobster(g, .5); return mm(g); } },
    { cat: 'Gelang', name: 'Gelang Bangle Pavé', file: 'gelang-bangle-pave', note: 'Kotak di sisi kanan adalah kunci gelang: lidah pegas masuk ke kotak, tekan tombol untuk membuka, pengaman angka-8 menahan agar tidak lepas. Sisi kiri adalah engsel.', fn() {
      const g = grp('pave_bangle'), hO = .8, w = 3.2, path = ellPath();
      splitBangle(g, 'bangle', w, hO, .7);
      const N = 38, sp = 2.15; pave(g, 'bangle', path, Array.from({ length: N }, (_, i) => tAt((i - (N - 1) / 2) * sp)).map(t => t > .5 ? t - 1 : t), .88, hO, 1.12);
      return mm(g); } },
  ];
}
