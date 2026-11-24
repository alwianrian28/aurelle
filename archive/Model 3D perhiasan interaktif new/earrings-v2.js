// Earrings v2: detailed findings (posts, butterfly backs, hinged hoops, French hook) and pavé rails.
export function buildEarrings(THREE, h) {
  const { silver, chainMat, tube, bead, stone, mesh, mm, V, UP } = h;
  const silverDS = silver.clone(); silverDS.side = THREE.DoubleSide;
  const holeMat = new THREE.MeshStandardMaterial({ name: 'socket_shadow', color: 0x07080a, roughness: .9, metalness: 0 });
  const PI = Math.PI, TAU = PI * 2, Z = V(0, 0, 1);
  const grp = (n) => { const g = new THREE.Group(); g.name = n; return g; };
  const torus = (n, r, t, seg = 40, arc = TAU) => mesh(n, new THREE.TorusGeometry(r, t, 12, seg, arc), silver);
  const pair = (n, build) => { const g = grp(n); [-1, 1].forEach((s) => { const e = build(s > 0 ? 'right' : 'left', s); e.position.x = s * 12; e.rotation.y = s * .25; g.add(e); }); return mm(g); };

  // Band with ring cross-section along path(u) -> {p, n}; width axis = tangent × n
  function band(name, path, segs, w, hO, hIn, closed = false) {
    const K = 14, pos = [], idx = [], T = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), prof = [];
    for (let k = 0; k <= K; k++) { const v = -1 + 2 * k / K; prof.push([v, hO * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), 4)), .25)]); }
    for (let k = K - 1; k >= 1; k--) { const v = -1 + 2 * k / K; prof.push([v * .97, -hIn * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), 4)), .25)]); }
    const M = prof.length, rings = closed ? segs : segs + 1;
    for (let i = 0; i < rings; i++) {
      const u = i / segs, { p, n } = path(u);
      T.copy(path(Math.min(1, u + 1e-4)).p).sub(path(Math.max(0, u - 1e-4)).p).normalize(); B.crossVectors(T, n).normalize();
      for (const [v, o] of prof) { P.copy(p).addScaledVector(B, v * w / 2).addScaledVector(n, o); pos.push(P.x, P.y, P.z); }
    }
    for (let i = 0; i < (closed ? rings : rings - 1); i++) for (let k = 0; k < M; k++) {
      const a = i * M + k, b = i * M + (k + 1) % M, c = ((i + 1) % rings) * M + k, d = ((i + 1) % rings) * M + (k + 1) % M; idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(name, geo, silverDS);
  }
  function pave(g, name, path, us, r, hO, beadOff) {
    const T = new THREE.Vector3(), B = new THREE.Vector3();
    const fr = (u) => { const { p, n } = path(u); T.copy(path(u + 1e-4).p).sub(path(u - 1e-4).p).normalize(); B.crossVectors(T, n).normalize(); return { p, n, b: B.clone() }; };
    const step = us.length > 1 ? us[1] - us[0] : .05;
    us.forEach((u, i) => {
      const { p, n } = fr(u), c = p.clone().addScaledVector(n, hO + .02);
      const s = stone(name + '_stone' + (i + 1), r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
      const seat = mesh(name + '_seat' + (i + 1), new THREE.TorusGeometry(r * 1.02, .06, 8, 32), silver); seat.position.copy(c).addScaledVector(n, -.03); seat.quaternion.setFromUnitVectors(Z, n); g.add(seat);
    });
    for (let i = 0; i <= us.length; i++) {
      const u = i === 0 ? us[0] - step / 2 : i === us.length ? us[us.length - 1] + step / 2 : (us[i - 1] + us[i]) / 2, { p, n, b } = fr(u);
      [-1, 1].forEach((sd, j) => g.add(bead(name + '_bead' + (i + 1) + '_' + (j + 1), r * .32, p.clone().addScaledVector(n, hO * .85 + r * .1).addScaledVector(b, sd * beadOff))));
    }
  }
  // Round collet facing +z; optional soldered loops (top/bottom) for hanging parts
  function collet(g, name, r, c, { top = false, bottom = false } = {}) {
    const s = stone(name + '_stone', r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, Z); g.add(s);
    const cup = mesh(name + '_collet', new THREE.CylinderGeometry(r * 1.04 + .14, r * .6, r * 1.05, 40), silver); cup.position.copy(c).add(V(0, 0, -r * .55)); cup.rotation.x = PI / 2; g.add(cup);
    const lip = mesh(name + '_lip', new THREE.TorusGeometry(r * 1.04 + .08, .12, 10, 48), silver); lip.position.copy(c).add(V(0, 0, -.02)); g.add(lip);
    const out = {}, edge = r * 1.04 + .2, lr = .5, lt = .16;
    if (top) { const l = torus(name + '_top_loop', lr, lt, 28); l.position.copy(c).add(V(0, edge + lr - .1, -r * .3)); l.rotation.y = PI / 2; g.add(l); out.top = l.position.clone(); }
    if (bottom) { const l = torus(name + '_bottom_loop', lr, lt, 28); l.position.copy(c).add(V(0, -(edge + lr - .1), -r * .3)); l.rotation.y = PI / 2; g.add(l); out.bottom = l.position.clone(); out.bottomInner = l.position.clone().add(V(0, -lr + lt, 0)); }
    return out;
  }
  // Ear post with friction grooves, plus a small butterfly back (width W) sitting on the grooves
  function postAndBack(g, n, z0, len, W) {
    const p = mesh(n + '_post', new THREE.CylinderGeometry(.36, .36, len, 16), silver); p.rotation.x = PI / 2; p.position.z = z0 - len / 2; g.add(p);
    g.add(bead(n + '_post_tip', .36, V(0, 0, z0 - len)));
    const zc = z0 - len * .62;
    [-.45, 0, .45].forEach((o, i) => { const gr = mesh(n + '_post_groove' + (i + 1), new THREE.TorusGeometry(.36, .05, 6, 24), silver); gr.position.z = zc + o; g.add(gr); });
    // butterfly: lobed plate (ear side faces +z), two curled scrolls pinching the post, centre hub
    const sh = new THREE.Shape(), a = W / 2, b = W * .34;
    sh.moveTo(0, b * .55); sh.bezierCurveTo(a * .35, b * 1.25, a, b * 1.1, a, 0); sh.bezierCurveTo(a, -b * 1.1, a * .35, -b * 1.25, 0, -b * .55);
    sh.bezierCurveTo(-a * .35, -b * 1.25, -a, -b * 1.1, -a, 0); sh.bezierCurveTo(-a, b * 1.1, -a * .35, b * 1.25, 0, b * .55);
    const hole = new THREE.Path(); hole.absarc(0, 0, .42, 0, TAU, true); sh.holes.push(hole);
    const plate = mesh(n + '_butterfly_plate', new THREE.ExtrudeGeometry(sh, { depth: .28, bevelEnabled: true, bevelThickness: .07, bevelSize: .07, bevelSegments: 3, curveSegments: 24 }), silver);
    plate.position.z = zc - .2; g.add(plate);
    [-1, 1].forEach((sd, i) => { const sc = torus(n + '_butterfly_scroll' + (i + 1), W * .14, .16, 24, PI * 1.35);
      sc.position.set(sd * (W * .14 + .38), 0, zc + .2); sc.rotation.set(PI / 2, sd > 0 ? PI * .82 : PI * .18, 0); sc.rotation.order = 'YXZ'; g.add(sc); });
    const hub = mesh(n + '_butterfly_hub', new THREE.CylinderGeometry(.55, .6, .9, 24, 1, true), silverDS); hub.rotation.x = PI / 2; hub.position.z = zc - .55; g.add(hub);
  }
  const arcPath = (R, a0, a1) => (u) => { const a = a0 + u * (a1 - a0); return { p: V(R * Math.cos(a), R * Math.sin(a), 0), n: Z }; };
  // End cap with a socket hole the pin clicks into
  function socket(g, n, p, tg, rad, withHole) {
    const cap = mesh(n + '_cap', new THREE.CircleGeometry(rad, 32), silverDS); cap.position.copy(p); cap.quaternion.setFromUnitVectors(Z, tg); g.add(cap);
    const rim = mesh(n + '_rim', new THREE.TorusGeometry(rad * .96, .08, 8, 32), silver); rim.position.copy(p); rim.quaternion.setFromUnitVectors(Z, tg); g.add(rim);
    if (withHole) { const ho = mesh(n + '_hole', new THREE.CircleGeometry(.36, 24), holeMat); ho.position.copy(p).addScaledVector(tg, .01); ho.quaternion.setFromUnitVectors(Z, tg); g.add(ho); }
  }
  // Hinged hoop body with pavé front, hinge at end A, socket at end B; gate/pin shown swung open
  function hingedHoop(e, s, R, w, hO, gapDeg, { gateDeg = 0, pinR = .32, stoneR = .6, beadOff }) {
    const g = gapDeg * PI / 180, gate = gateDeg * PI / 180, aA = PI / 2 + g, aB = PI / 2 - g + TAU;
    const bodyA = aA + (gate ? 0 : 0), path = arcPath(R, aA, aB);
    e.add(band('hoop_' + s, path, 260, w, hO, hO * .9));
    const L = (aB - aA) * R, N = Math.floor((L - 2.4) / (stoneR * 2 + .32));
    pave(e, 'hoop_' + s, path, Array.from({ length: N }, (_, i) => (1.2 / L) + (i + .5) / N * (1 - 2.4 / L)), stoneR, hO, beadOff ?? w * .4);
    const pA = V(R * Math.cos(aA), R * Math.sin(aA), 0), pB = V(R * Math.cos(aB), R * Math.sin(aB), 0);
    const tA = V(Math.sin(aA), -Math.cos(aA), 0), tB = V(-Math.sin(aB), Math.cos(aB), 0), radA = V(Math.cos(aA), Math.sin(aA), 0);
    socket(e, 'hoop_' + s + '_hinge_end', pA, tA, w * .48, false);
    socket(e, 'hoop_' + s + '_socket', pB, tB, w * .48, true);
    // hinge knuckle + swinging part pivoting about the radial axis at A (swings toward the back, -z)
    const kn = mesh('hoop_' + s + '_hinge_knuckle', new THREE.CapsuleGeometry(.5, w * .6, 8, 32), silver); kn.position.copy(pA).addScaledVector(tA, .4); kn.quaternion.setFromUnitVectors(UP, radA); e.add(kn);
    const piv = grp('hoop_' + s + '_swing'); piv.position.copy(pA).addScaledVector(tA, .4); e.add(piv);
    const span = 2 * g * R + .6;
    if (gate) {   // huggie: rounded hinged gate (round section, domed ends) with the post at its tip
      const gr = Math.min(w, hO * 2) * .46;
      const gp = (u) => { const a = aA - .4 / R - u * (2 * g - .9 / R); const p = V(R * Math.cos(a), R * Math.sin(a), 0).sub(piv.position); return { p, n: Z }; };
      piv.add(tube('hoop_' + s + '_gate', (u) => gp(u).p, 48, gr, false, silver, 32));
      piv.add(bead('hoop_' + s + '_gate_end_hinge', gr, gp(0).p), bead('hoop_' + s + '_gate_end_tip', gr, gp(1).p));
      const end = gp(1).p, tg = gp(1).p.clone().sub(gp(.98).p).normalize();
      const pin = mesh('hoop_' + s + '_gate_post', new THREE.CylinderGeometry(pinR, pinR, 1.4, 14), silver); pin.position.copy(end).addScaledVector(tg, .7); pin.quaternion.setFromUnitVectors(UP, tg); piv.add(pin);
      piv.add(bead('hoop_' + s + '_gate_post_tip', pinR, end.clone().addScaledVector(tg, 1.4)));
    } else {      // hoop: thin ear wire across the gap
      const wire = mesh('hoop_' + s + '_ear_wire', new THREE.CylinderGeometry(pinR, pinR, span, 14), silver); wire.position.copy(tA).multiplyScalar(span / 2); wire.quaternion.setFromUnitVectors(UP, tA); piv.add(wire);
      piv.add(bead('hoop_' + s + '_ear_wire_tip', pinR, tA.clone().multiplyScalar(span)));
    }
    piv.quaternion.setFromAxisAngle(radA, -0.6);
  }
  // u values spaced evenly by arc length (closed path), keeping `skip` mm clear on both sides of u=0
  function evenU(path, spacing, skip) {
    const S = [0]; let p = path(0).p; for (let i = 1; i <= 2000; i++) { const q = path(i / 2000).p; S.push(S[i - 1] + q.distanceTo(p)); p = q; }
    const L = S[2000], usable = L - 2 * skip, n = Math.floor(usable / spacing), st = usable / n, out = [];
    for (let k = 0; k <= n; k++) { const s = skip + k * st; let i = 1; while (S[i] < s) i++; out.push((i - 1 + (s - S[i - 1]) / (S[i] - S[i - 1])) / 2000); }
    return out;
  }
  // Hand-formed wire: thickness varies along its length; oval section (wider in-plane than deep)
  function wire(name, fn, segs, base, closed, seed = 0) {
    const pts = []; for (let i = 0; i <= segs; i++) pts.push(fn(i / segs));
    const c = new THREE.CatmullRomCurve3(closed ? pts.slice(0, -1) : pts, closed, 'centripetal'), fr = c.computeFrenetFrames(segs, closed);
    const RAD = 14, pos = [], idx = [], P = new THREE.Vector3(), rings = closed ? segs : segs + 1;
    for (let i = 0; i < rings; i++) {
      const u = i / segs, p = c.getPointAt(u), rr = base * (1 + .22 * Math.sin(u * TAU * 7 + seed) + .1 * Math.sin(u * TAU * 19 + seed * 2.3));
      const end = closed ? 1 : Math.min(1, Math.min(u, 1 - u) * segs / 3 + .55);
      const T = c.getTangentAt(u), N = Math.abs(T.z) < .9 ? new THREE.Vector3().crossVectors(T, Z).normalize() : fr.normals[i], Bv = new THREE.Vector3().crossVectors(T, N).normalize();
      for (let k = 0; k < RAD; k++) { const th = k / RAD * TAU; P.copy(p).addScaledVector(N, Math.cos(th) * rr * end).addScaledVector(Bv, Math.sin(th) * rr * .62 * end); pos.push(P.x, P.y, P.z); }
    }
    for (let i = 0; i < (closed ? rings : rings - 1); i++) for (let k = 0; k < RAD; k++) { const a = i * RAD + k, b = i * RAD + (k + 1) % RAD, cc = ((i + 1) % rings) * RAD + k, d = ((i + 1) % rings) * RAD + (k + 1) % RAD; idx.push(a, cc, b, b, cc, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(name, geo, silverDS);
  }
  function shallowBezel(e, n, rs, c) {
    const st = stone(n + '_stone', rs); st.position.copy(c); st.quaternion.setFromUnitVectors(UP, Z); e.add(st);
    const cup = mesh(n + '_bezel', new THREE.CylinderGeometry(rs * 1.04 + .07, rs * .55, rs * .88, 40), silver); cup.position.copy(c).add(V(0, 0, -rs * .46)); cup.rotation.x = PI / 2; e.add(cup);
    const lip = mesh(n + '_lip', new THREE.TorusGeometry(rs * 1.04 + .045, .065, 10, 48), silver); lip.position.copy(c).add(V(0, 0, -.02)); e.add(lip);
    return { back: c.z - rs * .9 };
  }
  function frenchHook(e, s, k = 1) {
    const eye = torus('hook_eye_' + s, .62, .18, 28); eye.rotation.y = PI / 2; e.add(eye);
    const pts = [V(0, .6, 0), V(.25, 4, 0), V(.2, 7.6, -.3), V(-1.1, 10.3, -.8), V(-3.5, 11.3, -1.2), V(-5.9, 10.5, -1.2), V(-7.6, 8.3, -1.0), V(-9.4, 5.8, -.8), V(-11.2, 3.7, -.6)].map((p, i) => i ? V(p.x * k, .6 + (p.y - .6) * k, p.z * k) : p);
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    e.add(tube('hook_wire_' + s, (t) => c.getPoint(t), 200, .34, false, silver, 16));
    e.add(bead('hook_tail_end_' + s, .34, pts[pts.length - 1]));
    e.add(solder('hook_eye_joint_' + s, V(0, .62, 0), .4));
    const jr = torus('jump_ring_' + s, .7, .2, 32); jr.position.set(0, -.62, 0); e.add(jr);
    return jr.position.y - .7 + .2;   // inner bottom of the jump ring
  }
  const solder = (n, p, r = .5) => { const b = bead(n, r, p); b.scale.z = .55; return b; };
  const teardrop = (w, ht, cy) => (t) => { const a = t * TAU; return V(w * Math.sin(a) * Math.abs(Math.sin(a / 2)), cy + ht * Math.cos(a), 0); };

  return [
    { cat: 'Anting', name: 'Anting Stud', file: 'anting-stud', note: 'Jarum masuk lewat lubang telinga, lalu kupu-kupu di belakang didorong sampai menjepit alur jarum.', fn() {
      return pair('stud_earrings', (s) => { const e = grp('stud_' + s); collet(e, 'stud_' + s, 2.4, V(0, 0, 0)); postAndBack(e, 'stud_' + s, -2.4, 10.5, 3.9); return e; }); } },
    { cat: 'Anting', name: 'Anting Hoop', file: 'anting-hoop', note: 'Ditampilkan dalam posisi terbuka: kawat telinga berengsel di kiri atas diayun ke belakang, masuk lewat lubang telinga, lalu dikunci ke soket di ujung kanan.', fn() {
      return pair('hoop_earrings', (s) => { const e = grp('hoop_' + s); hingedHoop(e, s, 8, 2.0, .85, 13, { stoneR: .62, beadOff: .78 }); return e; }); } },
    { cat: 'Anting', name: 'Anting Huggie', file: 'anting-huggie', note: 'Bagian atas adalah pintu berengsel (ditampilkan terbuka). Jarum di ujung pintu masuk ke lubang telinga, lalu pintu ditutup sampai klik ke soket.', fn() {
      return pair('huggie_earrings', (s) => { const e = grp('huggie_' + s); hingedHoop(e, s, 5.6, 2.4, 1.05, 36, { gateDeg: 72, pinR: .34, stoneR: .66, beadOff: .95 }); return e; }); } },
    { cat: 'Anting', name: 'Anting Drop', file: 'anting-drop', note: 'Batu atas berjarum dan berpenahan kupu-kupu. Dari batu atas menggantung rantai, batu kecil penyambung, lalu liontin tetes berlian.', fn() {
      return pair('drop_earrings', (s) => { const e = grp('drop_' + s);
        const top = collet(e, 'top_' + s, 1.6, V(0, 0, 0), { bottom: true }); postAndBack(e, 'top_' + s, -1.6, 9.5, 3.0);
        const cz = top.bottom.z, y0 = top.bottomInner.y + .1, len = 12;
        e.add(tube('drop_chain_' + s, (t) => V(0, y0 - t * len, cz), 40, .26, false, chainMat, 6));
        const mid = collet(e, 'mid_' + s, 1.0, V(0, y0 - len - .75 - 1.25, cz + .3), { top: true, bottom: true });
        const tw = 3.4, th = 5.2, tipY = mid.bottomInner.y - .55, td = teardrop(tw, th, tipY - th - .45);
        const hang = torus('teardrop_bail_' + s, .5, .16, 28); hang.position.set(0, tipY + .05, cz); e.add(hang);
        const tp = (u) => ({ p: td(u).add(V(0, 0, cz)), n: Z });
        e.add(band('teardrop_rail_' + s, tp, 260, 1.1, .45, .4, true));
        pave(e, 'teardrop_' + s, tp, evenU(tp, 1.22, 1.3), .42, .45, .48);
        return e; }); } },
    { cat: 'Anting', name: 'Anting Kait', file: 'anting-kait', note: 'Kait Prancis: kawat masuk lubang telinga dari depan dan menggantung di belakang daun telinga. Batu menggantung dari mata kait di bawah.', fn() {
      return pair('hook_earrings', (s) => { const e = grp('hook_' + s);
        const jrIn = frenchHook(e, s, .72);
        const rs = 1.6, edge = rs * 1.04 + .2, loop = torus('dangle_' + s + '_top_loop', .5, .16, 28); loop.rotation.y = PI / 2;
        const ly = jrIn - .5 + .3; loop.position.set(0, ly, -.25); e.add(loop);
        shallowBezel(e, 'dangle_' + s, rs, V(0, ly - .5 - edge + .25, .3));
        return e; }); } },
    { cat: 'Anting', name: 'Anting Climber', file: 'anting-climber', note: 'Ear climber: jarum di batu paling bawah masuk lubang telinga, deretan sembilan batu bercakar naik mengikuti daun telinga, dengan kawat melengkung yang membingkai dari bawah.', fn() {
      return pair('climber_earrings', (s, sg) => { const e = grp('climber_' + s), mx = sg;
        const N = 9, PX = 2.8, C = Array.from({ length: N }, (_, i) => V(mx * (PX * i), .95 * i + .6 * Math.sin(i * .55), 0));
        const rs = C.map((_, i) => i === 0 ? 1.05 : i === N - 1 ? .88 : 1.0 - i * .012);
        // four-claw baskets on a hidden spine
        C.forEach((c, i) => { const r = rs[i], n = 'climber_' + s + '_' + (i + 1);
          const st = stone(n + '_stone', r); st.position.copy(c); st.quaternion.setFromUnitVectors(UP, Z); e.add(st);
          const dir = (i < N - 1 ? C[i + 1].clone().sub(c) : c.clone().sub(C[i - 1])).normalize(), ang = Math.atan2(dir.y, dir.x);
          const gal = mesh(n + '_gallery', new THREE.TorusGeometry(r * .86, .07, 8, 40), silver); gal.position.copy(c).add(V(0, 0, -r * .42)); e.add(gal);
          const base = mesh(n + '_base_ring', new THREE.TorusGeometry(r * .58, .08, 8, 40), silver); base.position.copy(c).add(V(0, 0, -.8)); e.add(base);
          [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4].forEach((o, k) => { const ca = Math.cos(ang + o), sa = Math.sin(ang + o), P = (rr, z) => c.clone().add(V(ca * rr * r, sa * rr * r, z));
            const cv2 = new THREE.CatmullRomCurve3([P(.8, r * .3), P(1.03, r * .05), P(.86, -r * .42), P(.58, -.8)], false, 'centripetal');
            e.add(tube(n + '_claw' + (k + 1), (t) => cv2.getPoint(t), 40, .11, false, silver, 10));
            e.add(bead(n + '_claw' + (k + 1) + '_tip', .14, P(.82, r * .3))); }); });
        const spine = new THREE.CatmullRomCurve3(C.map(c => c.clone().add(V(0, 0, -.82))), false, 'centripetal');
        e.add(tube('climber_spine_' + s, (t) => spine.getPoint(t), 120, .28, false, silver, 12));
        // sweeping frame wire: loops out to the side of the lower stones, crosses behind, runs under the line and rises to the top stones
        // frame wire: smooth S — loops out beside the lowest stones, crosses behind, runs under the line and joins the basket of the 2nd stone from the top
        // two C1-continuous cubic Béziers: side loop, then one smooth sweep under the line into stone N-1 (independent of the stone wobble)
        const Q = (px, py, pz) => V(mx * px, py, pz), end = C[N - 2].clone().add(V(0, 0, -.82)), ex = mx * end.x;
        const A0 = C[0].clone().add(V(0, 0, -.82)), A1 = Q(-8, -4, -.62), A2 = Q(-9, 10, -.5), A3 = Q(4, 3.8, -1.32);
        const B1 = A3.clone().multiplyScalar(2).sub(A2); B1.z = -1.42;
        const B2 = end.clone().add(V(-mx * 3.2, -1.6, -.15));
        const wc = new THREE.CurvePath(); wc.add(new THREE.CubicBezierCurve3(A0, A1, A2, A3)); wc.add(new THREE.CubicBezierCurve3(A3, B1, B2, end));
        const W = [A0];
        // soldered joins: both wire ends fused into the baskets/spine, post on a round pad
        [A0, end].forEach((p, i) => { const j = bead('climber_frame_join' + (i + 1) + '_' + s, .5, p); j.scale.set(1.15, 1.15, .8); e.add(j); });
        const pad = mesh('climber_post_pad_' + s, new THREE.CylinderGeometry(.55, .6, .2, 24), silver); pad.rotation.x = PI / 2; pad.position.set(0, 0, -1.1); e.add(pad);
        e.add(tube('climber_frame_wire_' + s, (t) => wc.getPoint(t), 200, .36, false, silver, 14));
        e.add(bead('climber_spine_cap1_' + s, .28, spine.getPoint(0)), bead('climber_spine_cap2_' + s, .28, spine.getPoint(1)));
        
        postAndBack(e, 'climber_' + s, -1.2, 10, 3.0);
        return e; }); } },
    { cat: 'Anting', name: 'Anting Bunga', file: 'anting-bunga', note: 'Huggie polos berengsel (klik di atas) dengan tab di bawahnya; cincin kecil menggantungkan liontin bunga tujuh batu.', fn() {
      return pair('flower_earrings', (s) => { const e = grp('flower_' + s);
        // plain hinged huggie: body + top gate separated by fine seams, hinge knuckle on the left seam
        const R = 4.2, w = .9, hO = .5, seam = .006, g0 = PI / 2 - .55, g1 = PI / 2 + .55;
        e.add(band('huggie_body_' + s, arcPath(R, g1 + seam, g0 + TAU - seam), 220, w, hO, hO));
        e.add(band('huggie_gate_' + s, arcPath(R, g0 + seam, g1 - seam), 60, w, hO, hO));
        const ka = g1, kn = mesh('huggie_' + s + '_hinge_knuckle', new THREE.CapsuleGeometry(.3, hO * 1.4, 6, 24), silver);
        kn.position.set((R + w * .32) * Math.cos(ka), (R + w * .32) * Math.sin(ka), 0); kn.rotation.x = PI / 2; e.add(kn);
        // soldered tab at the bottom, jump ring, flower bail
        const tab = torus('huggie_tab_' + s, .6, .22, 28); tab.position.set(0, -(R + w / 2) - .35, 0); tab.rotation.y = PI / 2; e.add(tab);
        const tabIn = tab.position.y - .6 + .22;
        const jr = torus('jump_ring_' + s, .85, .2, 32); jr.position.set(0, tabIn - .85 + .3, 0); e.add(jr);
        const jrIn = jr.position.y - .85 + .2;
        const bail = torus('flower_bail_' + s, .55, .2, 28); bail.position.set(0, jrIn - .55 + .32, -.3); bail.rotation.y = PI / 2; e.add(bail);
        // flower: centre + six petals, shared claws, pointed tips between petals, lobed back plate
        const fc = V(0, bail.position.y - .55 - 3.0, 0), pr = 1.95, rp = .92, rc = .88;
        const add = (n, r, p) => { const st = stone(n, r); st.position.copy(p); st.quaternion.setFromUnitVectors(UP, Z); e.add(st);
          const cup = mesh(n + '_cup', new THREE.CylinderGeometry(r * 1.02, r * .55, r * .9, 32), silver); cup.position.copy(p).add(V(0, 0, -r * .5)); cup.rotation.x = PI / 2; e.add(cup); };
        const claw = (n, p) => { const c = mesh(n + '_post', new THREE.CylinderGeometry(.13, .17, 1.45, 8), silver); c.rotation.x = PI / 2; c.position.copy(p).add(V(0, 0, -.45)); e.add(c); e.add(bead(n, .2, p.clone().add(V(0, 0, .3)))); };
        add('flower_' + s + '_centre', rc, fc.clone().add(V(0, 0, .12)));
        for (let i = 0; i < 6; i++) {
          const a = PI / 2 + i / 6 * TAU, b = a + PI / 6, pc = fc.clone().add(V(pr * Math.cos(a), pr * Math.sin(a), 0));
          add('flower_' + s + '_petal' + (i + 1), rp, pc);
          [-.62, .62].forEach((o, j) => claw('flower_' + s + '_petal' + (i + 1) + '_claw' + (j + 1), pc.clone().add(V(rp * 1.0 * Math.cos(a + o * 1.2), rp * 1.0 * Math.sin(a + o * 1.2), 0))));
          const tip = mesh('flower_' + s + '_tip' + (i + 1), new THREE.ConeGeometry(.26, 1.0, 12), silver); tip.position.copy(fc).add(V(2.25 * Math.cos(b), 2.25 * Math.sin(b), -.55)); tip.rotation.z = b - PI / 2; e.add(tip);
          claw('flower_' + s + '_inner_claw' + (i + 1), fc.clone().add(V(1.1 * Math.cos(b), 1.1 * Math.sin(b), 0)));
        }
        const sh = new THREE.Shape(); for (let k = 0; k <= 96; k++) { const t = k / 96 * TAU, rr = 2.35 + .55 * Math.cos(6 * (t - PI / 2)); const px = rr * Math.cos(t), py = rr * Math.sin(t); k ? sh.lineTo(px, py) : sh.moveTo(px, py); }
        const plate = mesh('flower_' + s + '_back_plate', new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2 }), silver);
        plate.position.copy(fc).add(V(0, 0, -1.15)); e.add(plate);
        const neck = mesh('flower_' + s + '_bail_post', new THREE.CylinderGeometry(.28, .28, .9, 12), silver); neck.position.set(0, bail.position.y - .75, -.5); e.add(neck);
        return e; }); } },
    { cat: 'Anting', name: 'Anting Bunga Kawat', file: 'anting-bunga-kawat', note: 'Kait Prancis dengan liontin bunga kawat berlubang: garis luar lima kelopak, garis kelopak di dalam, dan jari-jari yang menyatukan semuanya di tengah.', fn() {
      return pair('wire_flower_earrings', (s, sg) => { const e = grp('wire_flower_' + s), W = .36;
        frenchHook(e, s);
        // openwork flower (wires slightly flattened, gently irregular like hand-formed metal)
        const fl = grp('wire_flower_' + s + '_pendant'); fl.scale.z = .7; e.add(fl);
        const wob = (t, k) => .28 * Math.sin(3 * t + k) + .16 * Math.sin(7 * t + 2 * k);
        const rOut = (t) => 5.0 + 3.9 * Math.pow((1 + Math.cos(5 * (t - PI / 2))) / 2, .7) + wob(t, sg);
        const top = rOut(PI / 2), fc = V(0, -1.3 - top + .2, 0);
        const P = (r, t) => fc.clone().add(V(r * Math.cos(t), r * Math.sin(t), 0));
        fl.add(wire('outline_' + s, (u) => { const t = u * TAU; return P(rOut(t), t); }, 400, W * 1.1, true, sg));
        for (let k = 0; k < 5; k++) {
          const ph = PI / 2 + k * TAU / 5 + .08 * Math.sin(k * 2.1 + sg), vy = ph + PI / 5;
          const pts = [[.7, ph - 1.0], [2.5, ph - .44], [4.7, ph - .2], [5.8, ph + .02], [4.6, ph + .24], [2.4, ph + .46], [.7, ph + 1.0]].map(([r, t]) => P(r + wob(t, k) * .5, t));
          const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
          fl.add(wire('inner_petal_' + s + (k + 1), (u) => c.getPoint(u), 120, W * .95, false, k + sg));
          const sp = new THREE.CatmullRomCurve3([P(.6, vy), P(2.8, vy + .1 * Math.sin(k + sg)), P(rOut(vy) + .05, vy)], false, 'centripetal');
          fl.add(wire('spoke_' + s + (k + 1), (u) => sp.getPoint(u), 60, W * .9, false, k * 1.7));
          fl.add(solder('solder_rim_' + s + (k + 1), P(rOut(vy) - .05, vy), .52));
        }
        [1, 3].forEach((k, i) => { const ph = PI / 2 + k * TAU / 5, oc = P(6.85, ph + .05 * sg), ax = V(Math.cos(ph), Math.sin(ph), 0), tx = V(-ax.y, ax.x, 0);
          fl.add(wire('small_loop_' + s + (i + 1), (u) => { const a = u * TAU; return oc.clone().addScaledVector(ax, 1.05 * Math.cos(a)).addScaledVector(tx, .62 * Math.sin(a)); }, 60, W * .9, true, i + 3));
          fl.add(solder('solder_loop_' + s + (i + 1), oc.clone().addScaledVector(ax, -1.0), .45)); });
        fl.add(solder('solder_top_' + s, P(top - .1, PI / 2), .5));
        const hub = bead('centre_knot_' + s, 1.0, fc); hub.scale.z = .6; fl.add(hub);
        shallowBezel(e, 'centre_' + s, .8, fc.clone().add(V(0, 0, .58)));
        return e; }); } },
  ];
}
