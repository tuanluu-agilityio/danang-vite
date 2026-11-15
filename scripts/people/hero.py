"""/* ===== Hai siêu anh hùng nguyên bản cho Đi dạo + Xe máy: public/people/hero-m.glb, hero-f.glb (D-048) ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:hero
    # tức: node scripts/people/blender.mjs scripts/people/hero.py  (Blender 4.5; biến môi trường BLENDER nếu không ở chỗ mặc định)

Nguồn: Microsoft Rocketbox (MIT), cùng commit ghim với convert.py: Male_Adult_10 (convert số 0) -> hero-m.glb,
Female_Adult_03 (convert số 3) -> hero-f.glb. Dùng lại toàn bộ đường chuyển đổi của convert.py (tải nguồn vào .cache/,
gắn + nướng năm đoạn idle / walk / jog / sprint / photo, quay mặt +X, xuất GLB, vá extras) nên chuyển động, khung xương,
tỉ lệ trùng p0 / p3; chỉ chen vào bước vật liệu (bọc convert.fix_materials):
  1. xóa mọi mặt dùng vật liệu alpha (tóc tấm, mi, lông mày) và gỡ slot đó -> 2 primitive, mọi vật liệu OPAQUE;
  2. sơn lại texture thân (1024) / đầu (512) bằng numpy: tô từng tam giác vào không gian UV, nội suy vị trí / pháp tuyến
     tư thế gốc + vùng xương (nhóm đỉnh nặng nhất), rồi tính màu bộ đồ theo vị trí trên cơ thể (không phụ thuộc bố cục UV rời);
  3. bộ nam có thêm texture phát sáng (tia dây cầu, biểu tượng, kính) nối vào Emission -> glTF emissiveTexture;
     lúc chạy src/explore/stroll/rig.ts nhân với uNight (ban ngày không sáng).
Thiết kế (spec docs/superpowers/specs/2026-11-15-sieu-anh-hung-design.md §3, §10.4):
  nam "Dây Cầu Phát Sáng": xanh lam, tấm ngực đỏ hình thang + mặt trước đùi đỏ, 7 tia xanh băng xòe từ cổ như dây văng,
      biểu tượng hình thoi, mặt nạ xanh kính chữ T; găng / ủng / đai xanh đậm.
  nữ "Sóng Biển Đà Nẵng": xanh hải quân, hai dải sóng đỏ chéo vai -> hông đối diện viền trắng ngà, biểu tượng vòng tròn
      ba con sóng ở chỗ hai dải cắt, vòng cổ tay đỏ, mặt nạ hai kính hổ phách góc cạnh.
  Không lưới mạng nhện, không hình nhện, không hai mắt trắng lớn; mặt nạ / găng / ủng không đỏ.
Không sửa p0..p4.glb (xuất tạm vào .cache/hero-out rồi chuyển tên). Tất định (không số ngẫu nhiên; vân vải là hàm băm vị trí).
Cuối script: bảng (byte, tam giác, primitive, vật liệu, height, chân thấp nhất) + ảnh kiểm tra .cache/preview-hero/*.png.
"""
import bpy, bmesh, os, sys, math, shutil
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import convert as C   # noqa: E402  (khối __main__ của convert không chạy khi import)

REPO = C.REPO
OUT = os.path.join(REPO, 'public', 'people')
TMP = os.path.join(C.CACHE, 'hero-out')
PREV = os.path.join(C.CACHE, 'preview-hero')
JOBS = [(0, 'm', 'hero-m.glb'), (3, 'f', 'hero-f.glb')]   # (số nhân vật trong convert.CHARS, bộ đồ, tệp ra)
AA = 0.0025       # m — bề rộng mép mềm của hoa văn (chống răng cưa, ≈ 1 điểm ảnh texture thân)
DILATE = 12       # px — nở hoa văn ra ngoài đảo UV (lọc mipmap không lấy màu nền)

KIND = 'm'        # bộ đồ đang làm (đặt trước mỗi lần convert.convert)
STATS = {}


def hexc(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], dtype=np.float32)


# ===== Bảng màu (sRGB) =====
M_BASE, M_DARK, M_RED, M_CYAN, M_EDGE = hexc('#2453a6'), hexc('#16306b'), hexc('#b8262e'), hexc('#7fe3ff'), hexc('#0d1d45')
F_BASE, F_RED, F_IVORY, F_AMBER, F_DARK = hexc('#1b2f6b'), hexc('#c62f2f'), hexc('#f4f1e8'), hexc('#f2a12a'), hexc('#111d45')

REG = ('torso', 'arm', 'hand', 'leg', 'foot', 'head')


def region_of(name, face):
    if name in face or name == 'Bip01 Head': return 5
    if 'Finger' in name or 'Hand' in name: return 2
    if 'UpperArm' in name or 'Forearm' in name: return 1
    if 'Foot' in name or 'Toe' in name: return 4
    if 'Thigh' in name or 'Calf' in name: return 3
    return 0


def smask(d, w):
    """1 khi d < w, 0 khi d > w, mép mềm AA"""
    return np.clip((w - d) / AA + 0.5, 0.0, 1.0)


def mix(col, c, m):
    col += (c[None, :] - col) * m[:, None]


# ===== Tô tam giác vào không gian UV =====
def raster(me, uvname, mat_idx, size, attr):
    """attr: (số đỉnh, k). Trả (size*size, k) theo thứ tự hàng từ dưới lên (như Image.pixels) + mặt nạ đã phủ"""
    k = attr.shape[1]
    img = np.zeros((size, size, k), dtype=np.float32); fill = np.zeros((size, size), dtype=bool)
    uvd = me.uv_layers[uvname].data
    for t in me.loop_triangles:
        if t.material_index != mat_idx: continue
        uv = np.array([uvd[l].uv[:] for l in t.loops], dtype=np.float64) * size
        A = attr[list(t.vertices)]
        x0, y0 = max(int(math.floor(uv[:, 0].min())), 0), max(int(math.floor(uv[:, 1].min())), 0)
        x1, y1 = min(int(math.ceil(uv[:, 0].max())) + 1, size), min(int(math.ceil(uv[:, 1].max())) + 1, size)
        if x1 <= x0 or y1 <= y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = uv
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not m.any(): continue
        W = np.stack([w0[m], w1[m], w2[m]], 1).astype(np.float32)
        sub = img[y0:y1, x0:x1]; sub[m] = W @ A
        fill[y0:y1, x0:x1] |= m
    # nở ra ngoài đảo UV
    for _ in range(DILATE):
        acc = np.zeros_like(img); cnt = np.zeros(fill.shape, dtype=np.float32)
        fz = img * fill[..., None]
        for sh in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            acc += np.roll(fz, sh, (0, 1)); cnt += np.roll(fill, sh, (0, 1))
        new = (~fill) & (cnt > 0)
        if not new.any(): break
        img[new] = acc[new] / cnt[new][:, None]; fill = fill | new
    return img.reshape(-1, k), fill.reshape(-1)


def fabric(P):
    """vân vải rất nhẹ: hàm băm theo ô 5 mm, nhân 1 ± 0,03 (tất định)"""
    q = np.floor(P / 0.005)
    h = np.sin(q[:, 0] * 12.9898 + q[:, 1] * 78.233 + q[:, 2] * 37.719) * 43758.5453
    return 1.0 + 0.03 * ((h - np.floor(h)) * 2 - 1)


def seg_dist(px, pz, ax, az, bx, bz):
    vx, vz = bx - ax, bz - az
    t = np.clip(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1)
    return np.hypot(px - (ax + t * vx), pz - (az + t * vz))


# ===== Bộ đồ =====
def paint(kind, role, P, N, R, L):
    """P, N: (n, 3) vị trí / pháp tuyến (hệ Blender, mặt nhìn -Y); R: (n,) vùng; L: mốc giải phẫu. Trả (màu, phát sáng hoặc None)"""
    n = len(P)
    x = P[:, 0] - L['cx']; z = P[:, 2]
    front = N[:, 1] < -0.15                     # mặt hướng trước
    torso, arm, hand, leg, foot, head = (R == i for i in range(6))
    emi = np.zeros((n, 3), dtype=np.float32) if kind == 'm' else None
    zN, zC, zH, zK, zCalf = L['neck'], L['chest'], L['hip'], L['knee'], L['calf']
    if kind == 'm':
        col = np.tile(M_BASE, (n, 1))
        # găng, ủng (bàn chân + nửa dưới cẳng chân), đai lưng
        mix(col, M_DARK, (hand | foot).astype(np.float32))
        boot = leg & (z < zCalf); mix(col, M_DARK, boot.astype(np.float32))
        mix(col, M_DARK, (torso & (np.abs(z - (zH + 0.06)) < 0.02)).astype(np.float32))
        # tấm ngực đỏ hình thang (chỉ mặt trước), viền tối
        zt, zb = zN - 0.04, zC - 0.12
        u = np.clip((z - zb) / (zt - zb), 0, 1); hw = 0.11 + 0.06 * u
        inz = smask(np.maximum(z - zt, zb - z), 0.0)
        panel = torso & front
        m_edge = panel * np.minimum(smask(np.abs(x) - hw, 0.004), smask(np.maximum(z - zt, zb - z), 0.004))
        mix(col, M_EDGE, m_edge.astype(np.float32))
        m_red = panel * np.minimum(smask(np.abs(x) - hw, 0.0), inz)
        mix(col, M_RED, m_red.astype(np.float32))
        # mặt trước đùi đỏ
        # mặt trước đùi: tam giác đỏ nhọn xuống (rộng ở hông, nhọn trên gối), viền tối
        zt2, zb2 = zH - 0.06, zK + 0.12
        u2 = np.clip((z - zb2) / (zt2 - zb2), 0, 1)
        lx = np.minimum(np.abs(P[:, 0] - L['thighL']), np.abs(P[:, 0] - L['thighR']))
        thigh = (leg & (N[:, 1] < -0.3)).astype(np.float32) * smask(np.maximum(z - zt2, zb2 - z), 0.0)
        mix(col, M_EDGE, thigh * smask(lx - 0.075 * u2, 0.004))
        mix(col, M_RED, thigh * smask(lx - 0.075 * u2, 0.0))
        # 7 tia dây cầu: trước + sau thân, chiếu (x, z) từ điểm cổ tới đường hông
        glow = np.zeros(n, dtype=np.float32)
        ax, az = 0.0, zN - 0.015
        on_body = torso & (z < az) & (z > zH + 0.085)
        d = np.full(n, 9.0)
        for k in range(-3, 4): d = np.minimum(d, seg_dist(x, z, ax, az, k * 0.075, zH + 0.085))
        glow = np.maximum(glow, on_body * smask(d, 0.0035))
        # biểu tượng hình thoi giữa ngực, viền tối
        zE = zC - 0.02
        dd = np.abs(x) / 0.05 + np.abs(z - zE) / 0.07
        em = torso & front
        mix(col, M_EDGE, (em * smask(dd - 1.0, 0.09)).astype(np.float32))
        glow = np.maximum(glow, em * smask(dd - 1.0, 0.0))
        # vạch xanh băng trên cổ ủng
        glow = np.maximum(glow, leg * smask(np.abs(z - zCalf), 0.006))
        # mặt nạ: kính chữ T
        if head.any():
            E = L['eye']; ex, ez = P[:, 0] - E[0], z - E[2]
            fh = head & (N[:, 1] < -0.2) & (P[:, 1] < E[1] + 0.03)
            bar = np.minimum(smask(np.abs(ez), 0.018), smask(np.abs(ex), 0.075))
            stem = np.minimum(smask(np.abs(ex), 0.011), smask(np.maximum(ez - 0.0, -0.07 - ez), 0.0))
            vis = np.maximum(bar, stem)
            visb = np.maximum(np.minimum(smask(np.abs(ez), 0.022), smask(np.abs(ex), 0.079)),
                              np.minimum(smask(np.abs(ex), 0.015), smask(np.maximum(ez, -0.074 - ez), 0.0)))
            mix(col, M_EDGE, (fh * visb).astype(np.float32))
            glow = np.maximum(glow, fh * vis)
        mix(col, M_CYAN, glow)
        emi += glow[:, None] * M_CYAN[None, :]
    else:
        col = np.tile(F_BASE, (n, 1))
        # vòng cổ tay đỏ (cẳng tay sát bàn tay), ủng viền trắng ngà
        mix(col, F_RED, (arm & (np.linalg.norm(P - L['handL'], axis=1) < 0.05) | arm & (np.linalg.norm(P - L['handR'], axis=1) < 0.05)).astype(np.float32))
        boot = leg & (z < zCalf)
        mix(col, F_DARK, (boot | foot | hand).astype(np.float32))
        mix(col, F_IVORY, (leg * smask(np.abs(z - zCalf), 0.004)).astype(np.float32))
        # hai dải sóng chéo vai -> hông đối diện (trước + sau), viền trắng ngà
        zA, zB = zN - 0.06, zH + 0.06
        t = np.clip((z - zA) / (zB - zA), 0, 1)
        inb = torso & (z < zA + 0.04) & (z > zB - 0.03)
        for s in (1, -1):
            xc = s * 0.12 + t * (-0.22 * s) + 0.015 * np.sin(2 * math.pi * (z - zA) / 0.12)
            dx = np.abs(x - xc) * (abs(zB - zA) / math.hypot(abs(zB - zA), 0.22))   # khoảng cách vuông góc gần đúng
            sh = inb * smask(np.abs(x) - 0.15, 0.0)   # không lấn sang vai / tay (biên vùng xương theo tam giác thì răng cưa)
            mix(col, F_IVORY, (sh * smask(dx, 0.031)).astype(np.float32))
            mix(col, F_RED, (sh * smask(dx, 0.025)).astype(np.float32))
        # biểu tượng ở chỗ hai dải cắt: tròn nền, vòng trắng ngà, ba đường sóng
        zE = zA + (0.12 / 0.22) * (zB - zA)
        r = np.hypot(x, z - zE); em = torso & front
        mix(col, F_IVORY, (em * smask(r, 0.045)).astype(np.float32))
        mix(col, F_BASE, (em * smask(r, 0.039)).astype(np.float32))
        wav = np.full(n, 9.0)
        for k in (-1, 0, 1): wav = np.minimum(wav, np.abs(z - zE - k * 0.013 - 0.004 * np.sin(x * 2 * math.pi / 0.022)))
        mix(col, F_IVORY, (em * (r < 0.03) * smask(wav, 0.0022)).astype(np.float32))
        # mặt nạ: hai kính hổ phách góc cạnh, chỉ trắng ngà giữa đỉnh đầu
        if head.any():
            E = L['eye']; ex, ez = P[:, 0] - E[0], z - E[2]
            fh = head & (N[:, 1] < -0.2) & (P[:, 1] < E[1] + 0.03)
            for s in (1, -1):
                uu = s * ex - 0.034; vv = ez - 0.15 * uu
                hh = 0.013 - 0.006 * np.clip((uu + 0.021) / 0.042, 0, 1)
                lens = np.minimum(smask(np.abs(uu), 0.021), smask(np.abs(vv) - hh, 0.0))
                rim = np.minimum(smask(np.abs(uu), 0.024), smask(np.abs(vv) - hh, 0.003))
                mix(col, F_DARK, (fh * rim).astype(np.float32))
                mix(col, F_AMBER, (fh * lens).astype(np.float32))
            top = head & (ez > 0.03) & ~fh
            mix(col, F_IVORY, (top * smask(np.abs(ex), 0.002)).astype(np.float32))
    col *= fabric(P)[:, None]
    return np.clip(col, 0, 1), emi


def landmarks(arm):
    def b(n): return arm.matrix_world @ arm.data.bones[n].head_local
    eL, eR = b('Bip01 LEye'), b('Bip01 REye')
    pel = b('Bip01 Pelvis')
    calf = (b('Bip01 L Calf').z + b('Bip01 L Foot').z) / 2
    return dict(cx=pel.x, neck=b('Bip01 Neck').z, chest=b('Bip01 Spine2').z, hip=pel.z, knee=b('Bip01 L Calf').z, calf=calf,
                eye=np.array((eL + eR) / 2), thighL=(b('Bip01 L Thigh').x + b('Bip01 L Calf').x) / 2, thighR=(b('Bip01 R Thigh').x + b('Bip01 R Calf').x) / 2, handL=np.array(b('Bip01 L Hand')), handR=np.array(b('Bip01 R Hand')))


# ===== Bọc bước vật liệu của convert =====
_orig_fix = C.fix_materials


def hero_materials(log):
    _orig_fix(log)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    ob = next(o for o in bpy.data.objects if o.type == 'MESH')
    me = ob.data
    roles = []
    for m in me.materials:
        nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        alpha = any(l.to_node == bsdf and l.to_socket.name == 'Alpha' for l in nt.links)
        roles.append('alpha' if alpha else ('head' if 'head' in m.name.lower() else 'body'))
    tri0 = sum(len(p.vertices) - 2 for p in me.polygons)
    # 1) xóa mặt alpha + gỡ slot (đánh lại chỉ số vật liệu của các mặt còn lại)
    for idx in sorted([i for i, r in enumerate(roles) if r == 'alpha'], reverse=True):
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == idx], context='FACES')
        for f in bm.faces:
            if f.material_index > idx: f.material_index -= 1
        bm.to_mesh(me); bm.free()
        me.materials.pop(index=idx); roles.pop(idx)
    # 2) thuộc tính đỉnh ở tư thế gốc: vị trí, pháp tuyến, vùng xương (one-hot)
    face = set(C.descendants(arm, 'Bip01 Head'))
    names = [g.name for g in ob.vertex_groups]
    mw = ob.matrix_world; rot = mw.to_3x3()
    nv = len(me.vertices); attr = np.zeros((nv, 6 + len(REG)), dtype=np.float32)
    for v in me.vertices:
        p = mw @ v.co; nn = (rot @ v.normal).normalized()
        g = max(v.groups, key=lambda e: e.weight, default=None)
        r = region_of(names[g.group], face) if g else 0
        attr[v.index, :3] = p; attr[v.index, 3:6] = nn; attr[v.index, 6 + r] = 1
    me.calc_loop_triangles()
    uvname = next(u.name for u in me.uv_layers if u.active_render)
    L = landmarks(arm)
    for i, m in enumerate(me.materials):
        nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        col = next(l.from_node for l in nt.links if l.to_node == bsdf and l.to_socket.name == 'Base Color')
        size = C.TEX[roles[i]]
        A, fill = raster(me, uvname, i, size, attr)
        P, N = A[:, :3], A[:, 3:6]
        Nn = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-6)
        R = np.argmax(A[:, 6:], axis=1)
        c, e = paint(KIND, roles[i], P, Nn, R, L)
        img = bpy.data.images.new(f'hero_{KIND}_{roles[i]}', size, size, alpha=False)
        px = np.ones((size * size, 4), dtype=np.float32); px[:, :3] = c
        img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
        col.image = img
        if e is not None:
            ei = bpy.data.images.new(f'hero_{KIND}_{roles[i]}_glow', size, size, alpha=False)
            px = np.ones((size * size, 4), dtype=np.float32); px[:, :3] = e
            ei.pixels.foreach_set(px.ravel()); ei.update(); ei.pack()
            tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = ei
            nt.links.new(tn.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = 1.0
        log.append(f'anh hùng {KIND}: {m.name} -> {roles[i]} {size}px' + (' + phát sáng' if e is not None else ''))
    STATS[KIND] = dict(tri_src=tri0, tri=sum(len(p.vertices) - 2 for p in me.polygons))


C.fix_materials = hero_materials


# ===== Ảnh kiểm tra: nạp lại glb, tư thế idle khung đầu, 4 góc (+ đêm cho nam) =====
def preview(path, tag, night):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=path)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x, sc.render.resolution_y = 600, 900
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
    os.makedirs(PREV, exist_ok=True)
    shots = [('front', 0), ('q', 0.7), ('side', math.pi / 2), ('back', math.pi)] if not night else [('night', 0.35)]
    for name, a in shots:
        bg = (0.02, 0.025, 0.04, 1) if night else (0.62, 0.66, 0.72, 1)
        w.node_tree.nodes['Background'].inputs[0].default_value = bg
        sun.data.energy = 0.08 if night else 3.2
        sun.rotation_euler = (math.radians(50), 0, a + math.radians(40))
        c = Vector((0, 0, 0.92)); d = 4.2
        cam.location = c + Vector((math.cos(a) * d, math.sin(a) * d, 0.15))   # mô hình nhìn +X
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREV, f'{tag}-{name}.png'); bpy.ops.render.render(write_still=True)


def head_shot(path, tag):
    """cận đầu (mặt nạ) trước + nghiêng"""
    for name, a in (('face', 0.25), ('face-side', math.pi / 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene; bpy.ops.import_scene.gltf(filepath=path)
        sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x = sc.render.resolution_y = 500
        sc.view_settings.view_transform = 'Standard'
        w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.66, 0.72, 1)
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.2; sc.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(50), 0, a + math.radians(40))
        am = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        hb = next(b for b in am.pose.bones if b.name.replace('_', ' ') == 'Bip01 Head')
        c = am.matrix_world @ hb.head + Vector((0, 0, 0.05))
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 85
        cam.location = c + Vector((math.cos(a) * 1.3, math.sin(a) * 1.3, 0.05))
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(PREV, f'{tag}-{name}.png'); bpy.ops.render.render(write_still=True)


def foot_min(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ v.co).z for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() for v in o.data.vertices]   # tư thế gốc; bỏ lưới hình xương do bộ nạp glTF tạo
    return min(zs)


def license_note():
    f = os.path.join(OUT, 'LICENSE-Rocketbox.txt')
    txt = open(f, encoding='utf8').read()
    line = ('hero-m.glb, hero-f.glb: sửa đổi từ Male_Adult_10 / Female_Adult_03 bằng scripts/people/hero.py '
            '(bỏ tóc / mi, sơn bộ đồ siêu anh hùng nguyên bản của dự án, không liên quan nhân vật thương mại nào)\n')
    if line in txt: return
    head, sep, rest = txt.partition('\n\n')
    with open(f, 'w', encoding='utf8', newline='\n') as fh: fh.write(head + '\n' + line + sep + rest)


if __name__ == '__main__':
    global_kind = None
    os.makedirs(TMP, exist_ok=True)
    C.OUT = TMP
    res = []
    for k, kind, fn in JOBS:
        KIND = kind
        r = C.convert(k)
        src, dst = os.path.join(TMP, f'p{k}.glb'), os.path.join(OUT, fn)

        def patch(j, name=r['name']):
            j['scenes'][0]['extras']['source'] = (f'Microsoft Rocketbox {name} (MIT), commit {C.COMMIT[:7]}; '
                                                  'bộ đồ siêu anh hùng nguyên bản — scripts/people/hero.py')
        C.glb_patch(src, patch)
        shutil.move(src, dst)
        r['bytes'] = os.path.getsize(dst); r['file'] = fn; r['kind'] = kind
        res.append(r)
    license_note()
    print('\n===== ANH HÙNG =====')
    for r in res:
        dst = os.path.join(OUT, r['file'])
        fm = foot_min(dst)
        preview(dst, 'hero-' + r['kind'], False)
        if r['kind'] == 'm': preview(dst, 'hero-m', True)
        head_shot(dst, 'hero-' + r['kind'])
        s = STATS[r['kind']]
        print(f"{r['file']:11s} {r['bytes']:>9d} B  tam giác {s['tri_src']} -> {s['tri']} (gltf {r['tris']})  {r['prims']} primitive  "
              f"{r['mats']}  cao {r['height']} m  chân thấp nhất {fm:.3f} m  xương {r['bones']}")
        for nm, c in r['clips'].items(): print(f"    {nm:6s} speed {c['speed']:5.2f} m/s")
    print(f'ảnh kiểm tra: {PREV}')
