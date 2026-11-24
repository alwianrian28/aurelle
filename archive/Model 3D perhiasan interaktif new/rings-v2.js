// Refined oval ring + stacking set: real band cross-sections and flush pavé.
export function buildRings(THREE, h) {
  const { silver, stone, bead, mesh, mm, V, UP } = h;
  const silverDS = silver.clone(); silverDS.side = THREE.DoubleSide;
  const TAU = Math.PI * 2, R = 9.3;

  // Band with a ring cross-section: domed outside, comfort-fit inside, rounded edges.
  // path(u) -> { p, n } (n = outward surface normal). Width axis = tangent × n.
  function dBand(name, path, segs, w, hOut, hIn) {
    const K = 18, pos = [], idx = [], T = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), prof = [];
    for (let k = 0; k <= K; k++) { const v = -1 + 2 * k / K; prof.push([v, hOut * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), 4)), 0.25)]); }
    for (let k = K - 1; k >= 1; k--) { const v = -1 + 2 * k / K; prof.push([v * 0.97, -hIn * (0.82 + 0.18 * (1 - v * v))]); }
    const M = prof.length;
    for (let i = 0; i < segs; i++) {
      const u = i / segs, { p, n } = path(u);
      T.copy(path(u + 1e-4).p).sub(path(u - 1e-4).p).normalize(); B.crossVectors(T, n).normalize();
      for (const [v, o] of prof) { P.copy(p).addScaledVector(B, v * w / 2).addScaledVector(n, o); pos.push(P.x, P.y, P.z); }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < M; k++) {
      const a = i * M + k, b = i * M + (k + 1) % M, c = ((i + 1) % segs) * M + k, d = ((i + 1) % segs) * M + (k + 1) % M;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return mesh(name, geo, silverDS);
  }
  const circlePath = (Rr, zf = () => 0) => (u) => { const a = u * TAU; return { p: V(Rr * Math.sin(a), Rr * Math.cos(a), zf(a)), n: V(Math.sin(a), Math.cos(a), 0) }; };

  // Pavé: stones flush with the surface, bright-cut seat ring, shared beads between neighbours on both sides.
  function pave(g, name, path, us, r, hOut, beadOff) {
    const T = new THREE.Vector3(), B = new THREE.Vector3();
    const frame = (u) => { const { p, n } = path(u); T.copy(path(u + 1e-4).p).sub(path(u - 1e-4).p).normalize(); B.crossVectors(T, n).normalize(); return { p, n, b: B.clone() }; };
    us.forEach((u, i) => {
      const { p, n } = frame(u), c = p.clone().addScaledVector(n, hOut + 0.02);
      const s = stone(name + '_stone' + (i + 1), r); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); g.add(s);
      const seat = mesh(name + '_seat' + (i + 1), new THREE.TorusGeometry(r * 1.02, 0.07, 8, 32), silver);
      seat.position.copy(c).addScaledVector(n, -0.03); seat.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.add(seat);
    });
    const step = us[1] - us[0];
    for (let i = 0; i <= us.length; i++) {
      const u = i === 0 ? us[0] - step / 2 : i === us.length ? us[us.length - 1] + step / 2 : (us[i - 1] + us[i]) / 2;
      const { p, n, b } = frame(u);
      [-1, 1].forEach((sd, j) => g.add(bead(name + '_bead' + (i + 1) + '_' + (j + 1), r * 0.34, p.clone().addScaledVector(n, hOut * 0.85 + r * 0.12).addScaledVector(b, sd * beadOff))));
    }
  }

  function ovalRing() {
    const g = new THREE.Group(); g.name = 'oval_ring';
    g.add(dBand('band', circlePath(R), 256, 1.8, 0.68, 0.55));
    const ax = 5.8, az = 8.4, Rr = R + 0.5;
    const rail = (u) => { const a = u * TAU, x = ax * Math.cos(a), al = x / Rr; return { p: V(Rr * Math.sin(al), Rr * Math.cos(al), az * Math.sin(a)), n: V(Math.sin(al), Math.cos(al), 0) }; };
    g.add(dBand('oval_rail', rail, 256, 1.75, 0.55, 0.5));
    const N = 30; pave(g, 'oval', rail, Array.from({ length: N }, (_, i) => i / N), 0.62, 0.55, 0.78);
    return mm(g);
  }

  function stackRings() {
    const g = new THREE.Group(); g.name = 'stacking_rings';
    // Chevron (V softened so the band curves rather than kinks)
    const vr = new THREE.Group(); vr.name = 'chevron_ring';
    const vz = (a) => { const w = Math.atan2(Math.sin(a), Math.cos(a)), s = Math.sqrt(w * w + 0.004); return 2.8 * Math.max(0, 1 - s / 0.7); };
    const vpath = circlePath(R, vz);
    vr.add(dBand('chevron_band', vpath, 400, 1.5, 0.55, 0.45));
    pave(vr, 'chevron', vpath, Array.from({ length: 11 }, (_, i) => -0.095 + i * 0.019), 0.5, 0.55, 0.66);
    vr.position.z = 1.6;
    // Twin bezel stones
    const tr = new THREE.Group(); tr.name = 'twin_stone_ring';
    tr.add(dBand('twin_band', circlePath(R), 256, 1.6, 0.6, 0.5));
    [-0.19, 0.19].forEach((a, i) => {
      const n = V(Math.sin(a), Math.cos(a), 0), rs = 0.7, c = n.clone().multiplyScalar(R + 0.85);
      const s = stone('twin_stone' + (i + 1), rs); s.position.copy(c); s.quaternion.setFromUnitVectors(UP, n); tr.add(s);
      const cup = mesh('twin_bezel' + (i + 1), new THREE.CylinderGeometry(rs * 1.04 + 0.16, rs * 0.85, 1.0, 40), silver);
      cup.position.copy(c).addScaledVector(n, -0.52); cup.quaternion.setFromUnitVectors(UP, n); tr.add(cup);
      const lip = mesh('twin_bezel_lip' + (i + 1), new THREE.TorusGeometry(rs * 1.04 + 0.1, 0.12, 10, 40), silver);
      lip.position.copy(c).addScaledVector(n, -0.02); lip.quaternion.setFromUnitVectors(V(0, 0, 1), n); tr.add(lip);
    });
    // Full pavé eternity
    const er = new THREE.Group(); er.name = 'pave_eternity_ring';
    er.add(dBand('eternity_band', circlePath(R), 256, 1.8, 0.62, 0.5));
    const N = 34; pave(er, 'eternity', circlePath(R), Array.from({ length: N }, (_, i) => i / N), 0.72, 0.62, 0.86);
    er.position.z = -1.85;
    g.add(vr, tr, er);
    return mm(g);
  }
  return { ovalRing, stackRings };
}
