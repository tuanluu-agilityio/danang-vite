"""/* ===== Xuất bộ phụ kiện nhà ven sông: riverside_buildings.blend (collection kit) -> public/buildings/kit.glb ===== */
Cách chạy: npm run gen:buildings (sau build_building_library.py), hoặc riêng:
    node scripts/people/blender.mjs blender/scripts/export_assets.py
Hợp đồng: docs/superpowers/specs/2026-11-13-ven-song-chan-thuc-design.md §6.2.

Hai bước:
 1. Bộ xuất glTF của Blender (GLB, export_yup, thuộc tính tùy biến, màu đỉnh đang hoạt động, không vật liệu / camera / đèn,
    áp modifier) chỉ cho fam1..fam5 -> blender/.cache/kit-raw.glb. Vị trí trong .blend là hình đã giải ở kích thước tham chiếu
    (thuộc tính đối tượng 'ref') nên NORMAL của bộ xuất đúng.
 2. Đóng gói lại -> public/buildings/kit.glb: POSITION <- _ANC (neo trong hộp đơn vị), bỏ _ANC; NORMAL, _OFF, _RULE, _GLOW float;
    COLOR_0 VEC4 ubyte chuẩn hóa; chỉ mục uint16; bỏ vật liệu, extras. Trước khi ghi kiểm: _ANC × ref + _OFF trùng POSITION của
    bộ xuất (≤ 1 mm) — xác nhận bộ xuất không đổi trục thuộc tính tùy biến và không trộn đỉnh sai.
"""
import bpy, os, json, struct
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
BLEND = os.path.join(ROOT, 'blender', 'scenes', 'riverside_buildings.blend')
RAW = os.path.join(ROOT, 'blender', '.cache', 'kit-raw.glb')
OUT = os.path.join(ROOT, 'public', 'buildings', 'kit.glb')
FAMS = [f'fam{i}' for i in range(1, 6)]

CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def export_raw():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.ops.object.select_all(action='DESELECT')
    for n in FAMS:
        o = bpy.data.objects[n]; o.hide_set(False); o.select_set(True)
        bpy.context.view_layer.objects.active = o
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=RAW, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_attributes=True, export_normals=True, export_texcoords=False, export_tangents=False,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
                              export_materials='NONE', export_cameras=False, export_lights=False, export_animations=False,
                              export_skins=False, export_morph=False, export_extras=False)
    return {n: tuple(bpy.data.objects[n]['ref']) for n in FAMS}

def read_glb(path):
    b = open(path, 'rb').read()
    assert struct.unpack_from('<I', b, 0)[0] == 0x46546C67, 'không phải GLB'
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl])
    bl = struct.unpack_from('<I', b, 20 + jl)[0]
    return j, b[28 + jl:28 + jl + bl]

def accessor(j, bin_, i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    stride = v.get('byteStride', 0) or dt.itemsize * n
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * n), strides=(stride, 1)).copy().view(dt).reshape(a['count'], n)
    if a.get('normalized'):
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out

def repack(refs):
    j, bin_ = read_glb(RAW)
    chunks, views, accs, meshes, nodes = [], [], [], [], []
    size = [0]
    def add(arr, ctype, typ, target, norm=False, minmax=False):
        data = np.ascontiguousarray(arr).tobytes()
        pad = (-size[0]) % 4
        if pad: chunks.append(b'\0' * pad); size[0] += pad
        views.append({'buffer': 0, 'byteOffset': size[0], 'byteLength': len(data), **({'target': target} if target else {})})
        chunks.append(data); size[0] += len(data)
        acc = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
        if norm: acc['normalized'] = True
        if minmax:
            acc['min'] = [float(x) for x in arr.min(axis=0)]; acc['max'] = [float(x) for x in arr.max(axis=0)]
        accs.append(acc); return len(accs) - 1
    byname = {m['name']: m for m in j['meshes']}
    report = []
    for n in FAMS:
        m = byname[n]
        assert len(m['primitives']) == 1, f'{n}: {len(m["primitives"])} primitive'
        p = m['primitives'][0]; at = p['attributes']
        need = ['POSITION', 'NORMAL', 'COLOR_0', '_ANC', '_OFF', '_RULE', '_GLOW']
        miss = [k for k in need if k not in at]
        assert not miss, f'{n}: bộ xuất thiếu {miss}; có {list(at)}'
        pos, nrm, col = accessor(j, bin_, at['POSITION']), accessor(j, bin_, at['NORMAL']), accessor(j, bin_, at['COLOR_0'])
        anc, off = accessor(j, bin_, at['_ANC']), accessor(j, bin_, at['_OFF'])
        rule, glow = accessor(j, bin_, at['_RULE']), accessor(j, bin_, at['_GLOW'])
        idx = accessor(j, bin_, p['indices']).reshape(-1)
        if col.shape[1] == 3: col = np.concatenate([col, np.ones((col.shape[0], 1), np.float32)], 1)
        ref = np.array(refs[n], np.float32)
        err = np.abs(anc * ref + off - pos).max()
        assert err < 1e-3, f'{n}: _ANC × ref + _OFF lệch POSITION {err:.4f} m (bộ xuất đổi trục thuộc tính tùy biến?)'
        assert idx.max() < 65536
        col8 = np.clip(np.round(col * 255), 0, 255).astype(np.uint8)
        attrs = {'POSITION': add(anc.astype(np.float32), 5126, 'VEC3', 34962, minmax=True),
                 'NORMAL': add(nrm.astype(np.float32), 5126, 'VEC3', 34962),
                 'COLOR_0': add(col8, 5121, 'VEC4', 34962, norm=True),
                 '_OFF': add(off.astype(np.float32), 5126, 'VEC3', 34962),
                 '_RULE': add(rule.astype(np.float32), 5126, 'SCALAR', 34962),
                 '_GLOW': add(glow.astype(np.float32), 5126, 'SCALAR', 34962)}
        ind = add(idx.astype(np.uint16).reshape(-1, 1), 5123, 'SCALAR', 34963)
        meshes.append({'name': n, 'primitives': [{'attributes': attrs, 'indices': ind, 'mode': 4}]})
        nodes.append({'name': n, 'mesh': len(meshes) - 1})
        report.append(f'{n}: {len(idx) // 3} tam giác, {pos.shape[0]} đỉnh, lệch giải lại {err * 1000:.3f} mm')
    out = {'asset': {'version': '2.0', 'generator': 'blender/scripts/export_assets.py (Blender glTF exporter + đóng gói lại)'},
           'scene': 0, 'scenes': [{'name': 'kit', 'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
           'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': size[0]}]}
    bin_out = b''.join(chunks); bin_out += b'\0' * ((-len(bin_out)) % 4)
    out['buffers'][0]['byteLength'] = len(bin_out)
    js = json.dumps(out, separators=(',', ':')).encode('utf8'); js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_out)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_out), 0x004E4942)); f.write(bin_out)
    for r in report: print(r)
    print(f'đã ghi {OUT}: {total} byte')

repack(export_raw())
