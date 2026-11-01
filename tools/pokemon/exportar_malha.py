"""
Converte o pacote Let's Go (gfbmdl + gfbanm + bntx) em glb com esqueleto.

Só entra o que o jogo já pode colocar no mapa: a dex inicial, as evoluções
dessa lista e o Bulbasaur da party. O tamanho segue o Pokédex, com um piso
para o pequeno não sumir ao lado do jogador.
"""

import io
import json
import math
import struct
import sys
import zipfile
from contextlib import redirect_stdout
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
IMPORTER = RAIZ / "tools" / "vendor" / "importer-src" / "Pokemon-Switch-Model-Importer-Blender-main"
BNTX_DIR = RAIZ / "tools" / "vendor" / "bntx-src" / "BNTX-Extractor-master"
sys.path.insert(0, str(IMPORTER))
sys.path.insert(0, str(BNTX_DIR))

from GFLib.Anim.Animation import AnimationT
from GFLib.Anim.DynamicRotationTrack import DynamicRotationTrackT
from GFLib.Anim.DynamicVectorTrack import DynamicVectorTrackT
from GFLib.Anim.FixedRotationTrack import FixedRotationTrackT
from GFLib.Anim.FixedVectorTrack import FixedVectorTrackT
from GFLib.Anim.Framed16RotationTrack import Framed16RotationTrackT
from GFLib.Anim.Framed16VectorTrack import Framed16VectorTrackT
from GFLib.Anim.Framed8RotationTrack import Framed8RotationTrackT
from GFLib.Anim.Framed8VectorTrack import Framed8VectorTrackT
from GFLib.Model.Model import Model
import swizzle
from bntx_extract import blk_dims, bpps, readBNTX

import texture2ddecoder

ZIP_MODELO = RAIZ / "assets" / "models" / "LGPE-Poke.zip"
ZIP_ANIM = RAIZ / "assets" / "models" / "LGPE-PokeAnim.zip"
SAIDA = RAIZ / "assets" / "pokemon" / "malha"

# O jogador ocupa 2 unidades. A curva deixa o pequeno legível sem esticar o grandão.
ALTURA_M = {
    1: 0.7, 4: 0.6, 10: 0.3, 11: 0.7, 12: 1.1, 13: 0.3, 14: 0.6, 15: 1.0,
    16: 0.3, 17: 1.1, 18: 1.5, 19: 0.3, 20: 0.7, 21: 0.3, 22: 1.2,
    23: 2.0, 24: 3.5, 25: 0.4, 27: 0.6, 28: 1.0, 29: 0.4, 30: 0.8,
    32: 0.5, 33: 0.9, 41: 0.8, 42: 1.6, 43: 0.5, 44: 0.8, 46: 0.3,
    47: 1.0, 48: 1.0, 49: 1.5, 50: 0.2, 51: 0.7, 52: 0.4, 53: 1.0,
    56: 0.5, 57: 1.0, 58: 0.7, 60: 0.6, 61: 1.0, 63: 0.9, 64: 1.3,
    66: 0.8, 67: 1.5, 69: 0.7, 70: 1.0, 74: 0.4, 75: 1.0,
}

FORMATOS = {
    0: ("f", 4, False),
    1: ("e", 2, False),
    3: ("B", 1, False),
    5: ("H", 2, False),
    8: ("B", 1, True),
}

CLIPES = (
    ("idle", ("fi01_wait01", "ba10_waitA01", "kw01_wait01")),
    ("walk", ("fi20_walk01",)),
    ("run", ("fi21_run01",)),
    ("sleep", ("kw20_drowseA01", "kw20_drowseB01")),
    ("faint", ("ba41_down01",)),
    ("attack", ("ba20_buturi01",)),
    ("hit", ("ba30_damageS01",)),
)

# Base do mapa + evoluções que a população pode soltar + o inicial da party.
DEXES = (
    1,
    10, 11, 12,
    13, 14, 15,
    16, 17, 18,
    19, 20,
    21, 22,
    23, 24,
    25,
    27, 28,
    29, 30,
    32, 33,
    41, 42,
    43, 44,
    46, 47,
    48, 49,
    50, 51,
    52, 53,
    56, 57,
    58,
    60, 61,
    63, 64,
    66, 67,
    69, 70,
    74, 75,
)

ESCALA_QUAT = 0x7FFF
PI_QUARTO = math.pi / 4.0
PI_MEIO = math.pi / 2.0


def euler_xyz(x, y, z):
    cx, sx = math.cos(x * 0.5), math.sin(x * 0.5)
    cy, sy = math.cos(y * 0.5), math.sin(y * 0.5)
    cz, sz = math.cos(z * 0.5), math.sin(z * 0.5)
    return (
        sx * cy * cz - cx * sy * sz,
        cx * sy * cz + sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    )


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    )


def quat_gira_y(ang):
    return (0.0, math.sin(ang * 0.5), 0.0, math.cos(ang * 0.5))


def compat(prev, q):
    if prev is None:
        return q
    if prev[0] * q[0] + prev[1] * q[1] + prev[2] * q[2] + prev[3] * q[3] < 0:
        return (-q[0], -q[1], -q[2], -q[3])
    return q


def expandir(i):
    return i * (PI_MEIO / ESCALA_QUAT) - PI_QUARTO


def desempacotar_quat(x, y, z):
    pacote = (int(z) << 32) | (int(y) << 16) | int(x)
    q1 = expandir((pacote >> 3) & 0x7FFF)
    q2 = expandir((pacote >> 18) & 0x7FFF)
    q3 = expandir((pacote >> 33) & 0x7FFF)
    valores = [q1, q2, q3]
    maior = math.sqrt(max(1.0 - (q1 * q1 + q2 * q2 + q3 * q3), 0.0))
    valores.insert(pacote & 0b0011, maior)
    sinal = -1.0 if (pacote & 0b0100) else 1.0
    # Blender guarda (w, x, y, z). glTF quer (x, y, z, w).
    return (sinal * valores[0], sinal * valores[1], sinal * valores[2], sinal * valores[3])


def amostras_vetor(trilha, quadros):
    saida = [None] * quadros
    if trilha is None or getattr(trilha, "co", None) is None:
        return saida
    if isinstance(trilha, FixedVectorTrackT):
        saida[0] = (trilha.co.x, trilha.co.y, trilha.co.z)
    elif isinstance(trilha, DynamicVectorTrackT):
        for i, c in enumerate(trilha.co):
            if i < quadros:
                saida[i] = (c.x, c.y, c.z)
    elif isinstance(trilha, (Framed16VectorTrackT, Framed8VectorTrackT)):
        for i, frame in enumerate(trilha.frames):
            if 0 <= frame < quadros:
                c = trilha.co[i]
                saida[frame] = (c.x, c.y, c.z)
    return saida


def amostras_rot(trilha, quadros):
    saida = [None] * quadros
    if trilha is None or getattr(trilha, "co", None) is None:
        return saida
    if isinstance(trilha, FixedRotationTrackT):
        saida[0] = desempacotar_quat(trilha.co.x, trilha.co.y, trilha.co.z)
    elif isinstance(trilha, DynamicRotationTrackT):
        for i, c in enumerate(trilha.co):
            if i < quadros:
                saida[i] = desempacotar_quat(c.x, c.y, c.z)
    elif isinstance(trilha, (Framed16RotationTrackT, Framed8RotationTrackT)):
        for i, frame in enumerate(trilha.frames):
            if 0 <= frame < quadros:
                c = trilha.co[i]
                saida[frame] = desempacotar_quat(c.x, c.y, c.z)
    return saida


def segurar(amostras, descanso):
    atual = descanso
    saida = []
    for item in amostras:
        if item is not None:
            atual = item
        saida.append(atual)
    return saida


def mat_trs(t, q, s):
    x, y, z, w = q
    x2, y2, z2 = x + x, y + y, z + z
    xx, xy, xz = x * x2, x * y2, x * z2
    yy, yz, zz = y * y2, y * z2, z * z2
    wx, wy, wz = w * x2, w * y2, w * z2
    sx, sy, sz = s
    return [
        (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
        (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
        (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
        t[0], t[1], t[2], 1,
    ]


def mat_mul(a, b):
    out = [0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = (
                a[0 * 4 + r] * b[c * 4 + 0]
                + a[1 * 4 + r] * b[c * 4 + 1]
                + a[2 * 4 + r] * b[c * 4 + 2]
                + a[3 * 4 + r] * b[c * 4 + 3]
            )
    return out


def mat_inv(m):
    inv = [0] * 16
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10]
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10]
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9]
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9]
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10]
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10]
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9]
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9]
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6]
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6]
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5]
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5]
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6]
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6]
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5]
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5]
    det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]
    if abs(det) < 1e-12:
        return m[:]
    inv_det = 1.0 / det
    return [v * inv_det for v in inv]


def aplicar(m, x, y, z):
    return (
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )


def ler_vertices(mesh):
    tipos = []
    passos = []
    total = 0
    for t in range(mesh.AttributesLength()):
        attrib = mesh.Attributes(t)
        fmt, tamanho, normalizar = FORMATOS[attrib.BufferFormat()]
        conta = attrib.ElementCount()
        tipos.append((attrib.VertexType(), fmt, conta, normalizar))
        passos.append(tamanho * conta)
        total += tamanho * conta
    bruto = mesh.DataAsNumpy()
    if hasattr(bruto, "tobytes"):
        bruto = bruto.tobytes()
    else:
        bruto = bytes(bruto)
    n = len(bruto) // total
    pos, nrm, uv, uv2, cor, juntas, pesos = [], [], [], [], [], [], []
    for v in range(n):
        base = v * total
        off = 0
        for (vtype, fmt, conta, normalizar), passo in zip(tipos, passos):
            data = struct.unpack_from(f"<{conta}{fmt}", bruto, base + off)
            if normalizar:
                data = tuple(c / 255.0 for c in data)
            if vtype == 0:
                pos.append(data[:3])
            elif vtype == 1:
                nrm.append(data[:3])
            elif vtype == 3:
                uv.append((data[0], data[1]))
            elif vtype == 4:
                uv2.append((data[0], data[1]))
            elif vtype == 7:
                cor.append(data[:4] if len(data) >= 4 else (data[0], data[1], data[2], 1.0))
            elif vtype == 11:
                juntas.append(data[:4])
            elif vtype == 12:
                pesos.append(data[:4])
            off += passo
    return pos, nrm, uv, uv2, cor, juntas, pesos, mesh


def triangulos(mesh):
    faces = []
    mats = []
    for p in range(mesh.PolygonsLength()):
        poly = mesh.Polygons(p)
        mat = poly.MaterialIndex()
        n = poly.FacesLength()
        for i in range(0, n - 2, 3):
            faces.append((poly.Faces(i), poly.Faces(i + 1), poly.Faces(i + 2)))
            mats.append(mat)
    return faces, mats


def png_de_bntx(blob):
    with redirect_stdout(io.StringIO()):
        texturas = readBNTX(blob)
    if not texturas:
        return None
    tex = texturas[0]
    fmt = tex.format >> 8
    if fmt not in bpps:
        return None
    blk = blk_dims.get(fmt, (1, 1))
    bpp = bpps[fmt]
    tamanho = swizzle.DIV_ROUND_UP(tex.width, blk[0]) * swizzle.DIV_ROUND_UP(tex.height, blk[1]) * bpp
    cru = swizzle.deswizzle(
        tex.width, tex.height, blk[0], blk[1], bpp,
        tex.tileMode, tex.alignment, tex.sizeRange, tex.data,
    )[:tamanho]
    if fmt == 0x20:
        pixels = texture2ddecoder.decode_bc7(cru, tex.width, tex.height)
    elif fmt == 0x1c:
        pixels = texture2ddecoder.decode_bc3(cru, tex.width, tex.height)
    elif fmt == 0x1a:
        pixels = texture2ddecoder.decode_bc1(cru, tex.width, tex.height)
    elif fmt == 0x0B:
        pixels = cru[: tex.width * tex.height * 4]
    else:
        return None
    imagem = Image.frombytes("RGBA", (tex.width, tex.height), bytes(pixels))
    buf = io.BytesIO()
    imagem.save(buf, format="PNG", optimize=True)
    alfa = imagem.getextrema()[3]
    return buf.getvalue(), alfa[0] < 250


def achar_textura(zip_modelo, pasta, nome):
    chave = nome.decode("utf-8") if isinstance(nome, bytes) else nome
    caminho = f"{pasta}{chave}.bntx"
    if caminho in zip_modelo.namelist() if False else caminho:
        pass
    try:
        return zip_modelo.read(caminho)
    except KeyError:
        return None


def nome_clip(zip_anim, pasta, sufixos):
    for sufixo in sufixos:
        caminho = f"{pasta}{sufixo}.gfbanm"
        # pasta já inclui o id: bin/pokemon/pm0016_00/anm/pm0016_00_
        if caminho in zip_anim.NameToInfo:
            return caminho
    return None


def ler_clip(blob):
    anm = AnimationT.InitFromPackedBuf(bytearray(blob), 0)
    if anm.info is None or anm.skeleton is None or not anm.skeleton.tracks:
        return None
    return anm.info.frameRate or 30, anm.info.keyFrames, anm.skeleton.tracks


def ossos_de(mon):
    lista = []
    deform = []
    for i in range(mon.BonesLength()):
        osso = mon.Bones(i)
        nome = osso.Name().decode("utf-8")
        t = osso.Translation()
        r = osso.Rotation()
        s = osso.Scale()
        item = {
            "nome": nome,
            "pai": osso.Parent(),
            "t": (t.X(), t.Y(), t.Z()),
            "q": euler_xyz(r.X(), r.Y(), r.Z()),
            "s": (s.X(), s.Y(), s.Z()),
        }
        lista.append(item)
        if osso.RigidCheck() is None:
            deform.append(i)
    mundo = []
    for i, osso in enumerate(lista):
        local = mat_trs(osso["t"], osso["q"], osso["s"])
        if osso["pai"] >= 0:
            local = mat_mul(mundo[osso["pai"]], local)
        mundo.append(local)
    return lista, deform, mundo


def frente_do_modelo(ossos, mundo):
    origem = None
    ponta = None
    for i, osso in enumerate(ossos):
        nome = osso["nome"].lower()
        if origem is None and nome in ("waist", "origin", "hips"):
            origem = mundo[i]
        if any(p in nome for p in ("beak", "mouth", "nose", "snout")):
            ponta = mundo[i]
            break
    if ponta is None:
        for i, osso in enumerate(ossos):
            if osso["nome"].lower() == "head":
                ponta = mundo[i]
                break
    if origem is None or ponta is None:
        return 0.0
    dx = ponta[12] - origem[12]
    dz = ponta[14] - origem[14]
    if dx * dx + dz * dz < 1e-4:
        return 0.0
    return -math.atan2(dx, dz)


def altura_mundo(metros):
    return 0.95 + (max(metros, 0.15) ** 0.55) * 1.25


def floats_do_material(mat):
    saida = {}
    for j in range(mat.ValuesLength()):
        item = mat.Values(j)
        if item.Name():
            saida[item.Name().decode("utf-8")] = item.Value()
    return saida


def indice_amostra(mat, nome):
    for j in range(mat.TextureMapsLength()):
        tm = mat.TextureMaps(j)
        if tm.Sampler() and tm.Sampler().decode("utf-8") == nome:
            return tm.Index()
    return -1


def transformar_uv(u, v, tr):
    su, sv, tu, tv = tr
    return u * su + tu, v * sv + tv


def fora_da_folha(uvs, faces):
    for a, b, c in faces:
        for i in (a, b, c):
            if i >= len(uvs):
                continue
            u, v = uvs[i]
            if u < -0.02 or u > 1.02 or v < -0.02 or v > 1.02:
                return True
    return False


def pintar_iris(olho, iris, faces, uvs, uvs2, tr_olho, tr_iris):
    if not uvs2:
        return
    largura, altura = olho.size
    iw, ih = iris.size
    pix = olho.load()
    amostra = iris.load()

    def continuo(valores):
        base = math.floor(valores[0])
        saida = [v - base for v in valores]
        for i in range(1, 3):
            while saida[i] - saida[0] > 0.5:
                saida[i] -= 1.0
            while saida[0] - saida[i] > 0.5:
                saida[i] += 1.0
        return saida

    for a, b, c in faces:
        if max(a, b, c) >= len(uvs) or max(a, b, c) >= len(uvs2):
            continue
        ou, ov, iu, iv = [], [], [], []
        for i in (a, b, c):
            u, v = transformar_uv(uvs[i][0], uvs[i][1], tr_olho)
            ou.append(u)
            ov.append(v)
            u, v = transformar_uv(uvs2[i][0], uvs2[i][1], tr_iris)
            iu.append(u)
            iv.append(v)
        ou, ov = continuo(ou), continuo(ov)
        iu, iv = continuo(iu), continuo(iv)
        xs = [int((u - math.floor(u)) * (largura - 1)) for u in ou]
        ys = [int((1.0 - (v - math.floor(v))) * (altura - 1)) for v in ov]
        min_x, max_x = max(0, min(xs)), min(largura - 1, max(xs))
        min_y, max_y = max(0, min(ys)), min(altura - 1, max(ys))
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-6:
            continue
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                w0 = ((ys[1] - ys[2]) * (x - xs[2]) + (xs[2] - xs[1]) * (y - ys[2])) / den
                w1 = ((ys[2] - ys[0]) * (x - xs[2]) + (xs[0] - xs[2]) * (y - ys[2])) / den
                w2 = 1.0 - w0 - w1
                if w0 < -0.002 or w1 < -0.002 or w2 < -0.002:
                    continue
                r, g, b, alfa = pix[x, y]
                if r < 210 or g < 210 or b < 200:
                    continue
                iu_p = iu[0] * w0 + iu[1] * w1 + iu[2] * w2
                iv_p = iv[0] * w0 + iv[1] * w1 + iv[2] * w2
                ix = int((iu_p - math.floor(iu_p)) * (iw - 1))
                iy = int((1.0 - (iv_p - math.floor(iv_p))) * (ih - 1))
                ir, ig, ib, ia = amostra[max(0, min(iw - 1, ix)), max(0, min(ih - 1, iy))]
                pix[x, y] = (ir, ig, ib, alfa)


def exportar_um(zip_modelo, zip_anim, dex):
    pasta_id = f"pm{dex:04d}_00"
    base = f"bin/pokemon/{pasta_id}/"
    modelo_nome = f"{base}mdl/{pasta_id}.gfbmdl"
    if modelo_nome not in zip_modelo.NameToInfo:
        print(f"sem modelo {pasta_id}")
        return None
    mon = Model.GetRootAsModel(bytearray(zip_modelo.read(modelo_nome)), 0)
    ossos, deform, mundo = ossos_de(mon)
    giro = frente_do_modelo(ossos, mundo)
    qgiro = quat_gira_y(giro)

    nomes_tex = []
    for i in range(mon.TextureNamesLength()):
        nomes_tex.append(mon.TextureNames(i).decode("utf-8"))

    malhas = []
    for mi in range(mon.MeshesLength()):
        mesh = mon.Meshes(mi)
        pos, nrm, uv, uv2, cor, juntas, pesos, _ = ler_vertices(mesh)
        faces, mats = triangulos(mesh)
        if not pos or not faces:
            continue
        malhas.append({
            "pos": pos, "nrm": nrm, "uv": uv, "uv2": uv2, "cor": cor,
            "juntas": juntas, "pesos": pesos, "faces": faces, "mats": mats,
        })

    folhas = {}

    def folha(chave):
        if not chave:
            return None
        if chave in folhas:
            return folhas[chave]
        blob = achar_textura(zip_modelo, f"{base}mdl/", chave)
        saida = png_de_bntx(blob) if blob else None
        if not saida:
            folhas[chave] = None
            return None
        png, corta = saida
        folhas[chave] = {
            "im": Image.open(io.BytesIO(png)).convert("RGBA"),
            "corta": corta,
        }
        return folhas[chave]

    def grupos_do(indice):
        grupos = []
        for malha in malhas:
            escolhidas = [f for f, m in zip(malha["faces"], malha["mats"]) if m == indice]
            if escolhidas:
                grupos.append((malha, escolhidas))
        return grupos

    def para_png(entrada):
        if not entrada:
            return None, False
        if "png" not in entrada:
            buf = io.BytesIO()
            entrada["im"].save(buf, format="PNG", optimize=True)
            entrada["png"] = buf.getvalue()
        return entrada["png"], entrada["corta"]

    meta = []
    for i in range(mon.MaterialsLength()):
        mat = mon.Materials(i)
        nome = mat.Name().decode("utf-8")
        fl = floats_do_material(mat)
        tr = (
            fl.get("ColorUVScaleU", 1.0),
            fl.get("ColorUVScaleV", 1.0),
            fl.get("ColorUVTranslateU", 0.0),
            fl.get("ColorUVTranslateV", 0.0),
        )
        tr_iris = (
            fl.get("Layer1UVScaleU", 1.0),
            fl.get("Layer1UVScaleV", 1.0),
            fl.get("Layer1UVTranslateU", 0.0),
            fl.get("Layer1UVTranslateV", 0.0),
        )
        idx = indice_amostra(mat, "Col0Tex")
        idx_iris = indice_amostra(mat, "LyCol0Tex")
        chave = nomes_tex[idx] if 0 <= idx < len(nomes_tex) else ""
        chave_iris = nomes_tex[idx_iris] if 0 <= idx_iris < len(nomes_tex) else ""
        grupos = grupos_do(i)
        olho = "eye" in nome.lower() or "mouth" in nome.lower()
        repetir = olho or any(fora_da_folha(malha["uv"], faces) for malha, faces in grupos)
        meta.append({
            "nome": nome,
            "chave": chave,
            "chave_iris": chave_iris,
            "tr": tr if olho else None,
            "tr_iris": tr_iris,
            "grupos": grupos,
            "repetir": repetir,
        })

    for item in meta:
        if "iris" not in item["chave_iris"].lower() or not item["tr"]:
            continue
        destino = folha(item["chave"])
        origem = folha(item["chave_iris"])
        if destino and origem:
            for malha, faces in item["grupos"]:
                pintar_iris(
                    destino["im"], origem["im"], faces,
                    malha["uv"], malha["uv2"], item["tr"], item["tr_iris"],
                )
        destino_raro = folha(f"{item['chave']}_rare")
        origem_rara = folha(f"{item['chave_iris']}_rare") or origem
        if destino_raro and origem_rara:
            for malha, faces in item["grupos"]:
                pintar_iris(
                    destino_raro["im"], origem_rara["im"], faces,
                    malha["uv"], malha["uv2"], item["tr"], item["tr_iris"],
                )

    materiais = []
    for item in meta:
        png, corta = para_png(folha(item["chave"]))
        png_raro, _ = para_png(folha(f"{item['chave']}_rare"))
        nome = item["nome"].lower()
        materiais.append({
            "nome": item["nome"],
            "png": png,
            "raro": png_raro,
            "corte": corta or "eye" in nome,
            "duplo": "eye" in nome or "wing" in nome,
            "tr": item["tr"],
            "repetir": item["repetir"],
        })

    # Limites depois do giro, para o pé encostar no chão e o corpo ficar no centro.
    min_x = min_y = min_z = 1e9
    max_x = max_y = max_z = -1e9
    for malha in malhas:
        for x, y, z in malha["pos"]:
            rx, ry, rz = aplicar(mat_trs((0, 0, 0), qgiro, (1, 1, 1)), x, y, z)
            min_x, max_x = min(min_x, rx), max(max_x, rx)
            min_y, max_y = min(min_y, ry), max(max_y, ry)
            min_z, max_z = min(min_z, rz), max(max_z, rz)
    if min_y > 1e8:
        return None
    bruta = max(max_y - min_y, 1e-4)
    altura = altura_mundo(ALTURA_M.get(dex, 1.0))
    escala = altura / bruta
    centro_x = (min_x + max_x) * 0.5
    centro_z = (min_z + max_z) * 0.5
    raiz_t = (-centro_x * escala, -min_y * escala, -centro_z * escala)

    clipes = []
    pasta_anm = f"{base}anm/{pasta_id}_"
    por_nome = {osso["nome"]: i for i, osso in enumerate(ossos)}
    for nome_clip, sufixos in CLIPES:
        caminho = None
        for sufixo in sufixos:
            candidato = f"{pasta_anm}{sufixo}.gfbanm"
            if candidato in zip_anim.NameToInfo:
                caminho = candidato
                break
        if not caminho:
            continue
        lido = ler_clip(zip_anim.read(caminho))
        if not lido:
            continue
        fps, quadros, trilhas = lido
        canais = []
        for trilha in trilhas:
            if trilha is None or not trilha.name:
                continue
            idx = por_nome.get(trilha.name)
            if idx is None:
                continue
            osso = ossos[idx]
            loc = segurar(amostras_vetor(trilha.translate, quadros), osso["t"])
            esc = segurar(amostras_vetor(trilha.scale, quadros), osso["s"])
            rot_bruta = amostras_rot(trilha.rotate, quadros)
            rot = []
            prev = None
            atual = osso["q"]
            for item in rot_bruta:
                if item is not None:
                    atual = item
                atual = compat(prev, atual)
                prev = atual
                rot.append(atual)
            muda_r = any(trilha.rotate is not None and amostras_rot(trilha.rotate, quadros)[i] is not None for i in range(min(1, quadros)))
            tem_r = trilha.rotate is not None and getattr(trilha.rotate, "co", None) is not None
            tem_t = trilha.translate is not None and getattr(trilha.translate, "co", None) is not None
            tem_s = trilha.scale is not None and getattr(trilha.scale, "co", None) is not None
            if tem_t:
                canais.append(("translation", idx, loc))
            if tem_r:
                canais.append(("rotation", idx, rot))
            if tem_s:
                canais.append(("scale", idx, esc))
            del muda_r
        if canais:
            clipes.append({"nome": nome_clip, "fps": fps or 30, "quadros": quadros, "canais": canais})

    glb = montar_glb(ossos, deform, mundo, malhas, materiais, clipes, qgiro, raiz_t, escala)
    destino = SAIDA / f"{dex}.glb"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(glb)
    print(f"{pasta_id}  altura={altura:.2f}  malhas={len(malhas)}  clipes={[c['nome'] for c in clipes]}  {destino.stat().st_size // 1024}KB")
    return {"clips": [c["nome"] for c in clipes], "altura": round(altura, 3)}


def alinhar(buf, n=4):
    resto = len(buf) % n
    if resto:
        buf.extend(b"\x00" * (n - resto))


def empurrar(buf, dados):
    alinhar(buf)
    inicio = len(buf)
    buf.extend(dados)
    return inicio, len(dados)


def montar_glb(ossos, deform, mundo, malhas, materiais, clipes, qgiro, raiz_t, escala):
    buf = bytearray()
    accessors = []
    views = []
    images = []
    textures = []
    mats_json = []
    tex_de_png = {}

    def ver_png(png, repetir=False):
        if png is None:
            return None
        chave = id(png)
        if chave in tex_de_png:
            return tex_de_png[chave]
        off, n = empurrar(buf, png)
        view = len(views)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": n})
        img = len(images)
        images.append({"bufferView": view, "mimeType": "image/png"})
        textures.append({"source": img, "sampler": 1 if repetir else 0})
        tex_de_png[chave] = len(textures) - 1
        return tex_de_png[chave]

    for mat in materiais:
        base = {
            "name": mat["nome"],
            "doubleSided": mat["duplo"],
            "pbrMetallicRoughness": {
                "baseColorFactor": [1, 1, 1, 1],
                "metallicFactor": 0,
                "roughnessFactor": 0.62,
            },
        }
        tex = ver_png(mat["png"], mat["repetir"])
        if tex is not None:
            base["pbrMetallicRoughness"]["baseColorTexture"] = {"index": tex}
        if mat["corte"]:
            base["alphaMode"] = "MASK"
            base["alphaCutoff"] = 0.35
        raro = ver_png(mat["raro"], mat["repetir"])
        if raro is not None:
            # O loader precisa de uma referência real para baixar a textura.
            # O runtime tira isso do emissive antes de desenhar.
            base["emissiveTexture"] = {"index": raro}
            base["emissiveFactor"] = [0, 0, 0]
        mats_json.append(base)

    def acc_float(valores, tipo, componente):
        cru = bytearray()
        conta = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[tipo]
        minimo = [1e9] * conta
        maximo = [-1e9] * conta
        for item in valores:
            seq = item if conta > 1 else (item,)
            if conta == 16:
                seq = item
            for i, v in enumerate(seq):
                minimo[i] = min(minimo[i], v)
                maximo[i] = max(maximo[i], v)
                cru.extend(struct.pack("<f", float(v)))
        off, n = empurrar(buf, cru)
        view = len(views)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": n})
        accessors.append({
            "bufferView": view,
            "componentType": componente,
            "count": len(valores),
            "type": tipo,
            "min": minimo,
            "max": maximo,
        })
        return len(accessors) - 1

    def acc_curto(indices):
        cru = bytearray()
        maior = 0
        for a, b, c in indices:
            maior = max(maior, a, b, c)
            cru.extend(struct.pack("<HHH", a, b, c))
        if maior > 65535:
            cru = bytearray()
            for a, b, c in indices:
                cru.extend(struct.pack("<III", a, b, c))
            tipo = 5125
        else:
            tipo = 5123
        off, n = empurrar(buf, cru)
        view = len(views)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": n})
        accessors.append({
            "bufferView": view,
            "componentType": tipo,
            "count": len(indices) * 3,
            "type": "SCALAR",
        })
        return len(accessors) - 1

    ibms = []
    for idx in deform:
        ibms.append(mat_inv(mundo[idx]))
    acc_ibm = acc_float(ibms, "MAT4", 5126)

    primitivos = []
    for malha in malhas:
        por_mat = {}
        for face, mat in zip(malha["faces"], malha["mats"]):
            por_mat.setdefault(mat, []).append(face)
        for mat, faces in por_mat.items():
            if not faces:
                continue
            usados = sorted({i for f in faces for i in f})
            remap = {old: novo for novo, old in enumerate(usados)}
            faces_l = [(remap[a], remap[b], remap[c]) for a, b, c in faces]
            pos = [malha["pos"][i] for i in usados]
            attrs = {"POSITION": acc_float(pos, "VEC3", 5126)}
            if malha["nrm"]:
                attrs["NORMAL"] = acc_float([malha["nrm"][i] for i in usados], "VEC3", 5126)
            if malha["uv"]:
                tr = materiais[mat]["tr"] if 0 <= mat < len(materiais) else None
                coords = []
                for i in usados:
                    u, v = malha["uv"][i]
                    if tr:
                        u, v = transformar_uv(u, v, tr)
                    # O arquivo conta v de baixo para cima. No glTF, v 0 é o topo.
                    coords.append((u, 1.0 - v))
                attrs["TEXCOORD_0"] = acc_float(coords, "VEC2", 5126)
            if malha["juntas"] and malha["pesos"]:
                juntas = []
                pesos = []
                for i in usados:
                    js = malha["juntas"][i]
                    ws = malha["pesos"][i]
                    soma = ws[0] + ws[1] + ws[2] + ws[3]
                    if soma <= 1e-6:
                        ws = (1, 0, 0, 0)
                        soma = 1
                    pesos.append(tuple(c / soma for c in ws))
                    juntas.append(tuple(int(c) for c in js))
                cru = bytearray()
                for js in juntas:
                    cru.extend(struct.pack("<HHHH", *js))
                off, n = empurrar(buf, cru)
                view = len(views)
                views.append({"buffer": 0, "byteOffset": off, "byteLength": n})
                accessors.append({
                    "bufferView": view,
                    "componentType": 5123,
                    "count": len(juntas),
                    "type": "VEC4",
                })
                attrs["JOINTS_0"] = len(accessors) - 1
                attrs["WEIGHTS_0"] = acc_float(pesos, "VEC4", 5126)
            primitivos.append({
                "attributes": attrs,
                "indices": acc_curto(faces_l),
                "material": mat if 0 <= mat < len(mats_json) else 0,
            })

    nos = [{
        "name": "raiz",
        "translation": list(raiz_t),
        "rotation": list(qgiro),
        "scale": [escala, escala, escala],
        "children": [],
    }]
    for i, osso in enumerate(ossos):
        no = {
            "name": osso["nome"],
            "translation": list(osso["t"]),
            "rotation": list(osso["q"]),
            "scale": list(osso["s"]),
        }
        nos.append(no)
    no_malha = len(nos)
    nos.append({"name": "malha", "mesh": 0, "skin": 0})
    filhos_raiz = []
    for i, osso in enumerate(ossos):
        no_i = 1 + i
        if osso["pai"] < 0:
            filhos_raiz.append(no_i)
        else:
            pai = nos[1 + osso["pai"]]
            pai.setdefault("children", []).append(no_i)
    filhos_raiz.append(no_malha)
    nos[0]["children"] = filhos_raiz

    animacoes = []
    for clip in clipes:
        tempos = [i / clip["fps"] for i in range(clip["quadros"])]
        acc_tempo = acc_float(tempos, "SCALAR", 5126)
        canais_json = []
        samplers = []
        for caminho, idx, valores in clip["canais"]:
            tipo = {"translation": "VEC3", "rotation": "VEC4", "scale": "VEC3"}[caminho]
            acc_v = acc_float(valores, tipo, 5126)
            samplers.append({"input": acc_tempo, "output": acc_v, "interpolation": "LINEAR"})
            canais_json.append({
                "sampler": len(samplers) - 1,
                "target": {"node": 1 + idx, "path": caminho},
            })
        animacoes.append({"name": clip["nome"], "samplers": samplers, "channels": canais_json})

    gltf = {
        "asset": {"version": "2.0", "generator": "exportar_malha"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": nos,
        "skins": [{
            "skeleton": 1,
            "joints": [1 + i for i in deform],
            "inverseBindMatrices": acc_ibm,
        }],
        "meshes": [{"primitives": primitivos}],
        "materials": mats_json,
        "textures": textures,
        "images": images,
        "samplers": [
            {"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071},
            {"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497},
        ],
        "animations": animacoes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buf)}],
    }
    texto = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    alinhar_json = texto + b" " * ((4 - len(texto) % 4) % 4)
    alinhar(buf)
    total = 12 + 8 + len(alinhar_json) + 8 + len(buf)
    out = bytearray()
    out.extend(b"glTF")
    out.extend(struct.pack("<I", 2))
    out.extend(struct.pack("<I", total))
    out.extend(struct.pack("<I", len(alinhar_json)))
    out.extend(b"JSON")
    out.extend(alinhar_json)
    out.extend(struct.pack("<I", len(buf)))
    out.extend(b"BIN\x00")
    out.extend(buf)
    return bytes(out)


def main():
    pedidos = [int(a) for a in sys.argv[1:]] or list(DEXES)
    indice = {}
    if (SAIDA / "indice.json").exists() and sys.argv[1:]:
        indice = json.loads((SAIDA / "indice.json").read_text(encoding="utf-8"))
    with zipfile.ZipFile(ZIP_MODELO) as zip_modelo, zipfile.ZipFile(ZIP_ANIM) as zip_anim:
        for dex in pedidos:
            try:
                info = exportar_um(zip_modelo, zip_anim, dex)
            except Exception as erro:
                print(f"falhou {dex}: {erro}")
                continue
            if info:
                indice[str(dex)] = info
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"indice {len(indice)}")


if __name__ == "__main__":
    main()
