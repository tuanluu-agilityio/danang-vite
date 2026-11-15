/* ============================ Nhạc chủ đề "The Spirit of Da Nang": bản tổng phổ ============================
   Dữ liệu thuần (không Web Audio, nhập được trong Node để test): hợp âm, giai điệu chủ đề, bố cục các đoạn, cách chọn bản phối theo camera.
   Rê trưởng, 4/4, mỗi ô nhịp 16 bước (nốt móc kép). Cao độ ghi bằng số MIDI (La 4 = 69). Giai điệu chỉ dùng ngũ cung Rê – Mi – Fa♯ – La – Si:
   nét "miền biển Việt Nam" nằm ở thang âm và tiếng dây gảy, không dùng nhạc cụ dân tộc làm màu. Bộ phát ở music.ts đọc các bảng này. */

export type Layer = 'pad' | 'stab' | 'arp' | 'bass' | 'kick' | 'snare' | 'hat' | 'perc' | 'lead' | 'pluck' | 'bell' | 'air';
export const LAYERS: Layer[] = ['pad', 'stab', 'arp', 'bass', 'kick', 'snare', 'hat', 'perc', 'lead', 'pluck', 'bell', 'air'];

/* Bản phối theo chế độ: overview = toàn cảnh / màn chọn; tour = Tour có thuyết minh, kịch bản bão */
export type MusicMode = 'overview' | 'glider' | 'car' | 'bike' | 'stroll' | 'tour';
export const MUSIC_MODES: MusicMode[] = ['overview', 'glider', 'car', 'bike', 'stroll', 'tour'];

/* cam.mode (views/state.ts) → bản phối. Đang bay tới điểm đầu Tour (fly + then = 'tour') đã tính là tour để nhạc lùi trước khi giọng đọc cất lên.
   Ngồi cabin Vòng quay Mặt Trời nghe như đi dạo (chậm rãi, ngắm cảnh). Các góc nhìn camera còn lại dùng bản toàn cảnh */
export function musicModeOf(camMode: string, flightThen: string | null = null): MusicMode {
  if (camMode === 'glider') return 'glider';
  if (camMode === 'car') return 'car';
  if (camMode === 'bike') return 'bike';
  if (camMode === 'stroll' || camMode === 'swRide') return 'stroll';
  if (camMode === 'tour' || camMode === 'storm' || (camMode === 'fly' && flightThen === 'tour')) return 'tour';
  return 'overview';
}

/* ---------- Hợp âm: nốt trầm (MIDI) + các lớp cao độ (0 = Đô … 11 = Si) ---------- */
export interface Chord { bass: number; tones: number[] }
const ch = (bass: number, ...tones: number[]): Chord => ({ bass, tones });
const D = ch(38, 2, 6, 9, 4), AonCs = ch(37, 9, 1, 4), Bm = ch(35, 11, 2, 6, 9), Gmaj = ch(43, 7, 11, 2, 6), DonFs = ch(42, 2, 6, 9),
  G = ch(43, 7, 11, 2), Asus = ch(45, 9, 2, 4), A = ch(45, 9, 1, 4), Em = ch(40, 4, 7, 11, 2), BmHi = ch(47, 11, 2, 6);
export type ProgName = 'day' | 'night' | 'bridge' | 'lift';
export const PROG: Record<ProgName, Chord[]> = {
  day: [D, AonCs, Bm, Gmaj, DonFs, G, Asus, A],          // Rê trưởng: sáng, mở
  night: [Bm, G, D, A, Bm, G, Em, A],                    // cùng giai điệu, hoà âm theo Si thứ: huyền ảo hơn mà không buồn
  bridge: [G, A, BmHi, DonFs, G, A, BmHi, A],            // đoạn nối "Discover More"
  lift: [G, A, BmHi, A]                                  // 4 ô đẩy vào cao trào
};

/* ---------- Giai điệu: [bước tính từ đầu câu 8 ô, MIDI, độ dài tính bằng bước] ---------- */
export type Note = [number, number, number];
const at = (bar: number, notes: Note[]): Note[] => notes.map(([s, m, l]) => [s + bar * 16, m, l]);
/* Chủ đề: mô-típ đi lên La – Rê – Mi – Fa♯ ("lời mời"), câu 2 vươn tới La cao, câu 3 nhắc lại và lên Si, câu 4 lắng về Mi chờ quay lại Rê */
export const THEME: Note[] = [
  ...at(0, [[0, 69, 2], [2, 74, 2], [4, 76, 2], [6, 78, 8], [14, 76, 2]]),
  ...at(1, [[0, 76, 10], [10, 74, 2], [12, 76, 2], [14, 78, 2]]),
  ...at(2, [[0, 81, 8], [8, 78, 4], [12, 76, 2], [14, 74, 2]]),
  ...at(3, [[0, 74, 10], [10, 71, 2], [12, 74, 2], [14, 76, 2]]),
  ...at(4, [[0, 69, 2], [2, 74, 2], [4, 76, 2], [6, 78, 4], [10, 81, 6]]),
  ...at(5, [[0, 83, 8], [8, 81, 4], [12, 78, 4]]),
  ...at(6, [[0, 76, 6], [6, 74, 2], [8, 76, 4], [12, 78, 4]]),
  ...at(7, [[0, 76, 12], [12, 69, 2], [14, 73, 2]])
];
/* Đoạn nối: các nét ngắn hỏi – đáp leo dần, tới Rê cao rồi trả về chủ đề */
export const BRIDGE: Note[] = [
  ...at(0, [[0, 71, 2], [2, 74, 2], [4, 78, 4], [8, 76, 8]]),
  ...at(1, [[0, 76, 2], [2, 78, 2], [4, 81, 4], [8, 78, 8]]),
  ...at(2, [[0, 78, 2], [2, 81, 2], [4, 83, 4], [8, 81, 8]]),
  ...at(3, [[0, 81, 4], [4, 78, 4], [8, 74, 8]]),
  ...at(4, [[0, 71, 2], [2, 74, 2], [4, 78, 4], [8, 76, 8]]),
  ...at(5, [[0, 76, 2], [2, 78, 2], [4, 81, 4], [8, 78, 8]]),
  ...at(6, [[0, 83, 4], [4, 86, 8], [12, 83, 4]]),
  ...at(7, [[0, 81, 8], [8, 76, 4], [12, 73, 4]])
];
/* Bè dây đối đáp (một nốt mỗi ô, bộ phát kéo về nốt hợp âm gần nhất) */
export const COUNTER = [66, 64, 62, 62, 66, 67, 69, 73];

/* ---------- Bố cục ---------- */
export type DrumKit = 'none' | 'pulse' | 'half' | 'drive';   // pulse: trống cái bốn phách nhẹ; half: nửa nhịp (rộng, điện ảnh); drive: đủ bộ
export interface Section {
  name: string; bars: number;
  prog: 'main' | 'alt' | 'bridge' | 'lift';   // main: theo ngày / đêm lúc vào đoạn; alt: bản còn lại (đổi màu)
  progAt?: number;                            // bắt đầu từ ô nào của vòng hợp âm
  drums: DrumKit; bass: 'long' | 'pulse';
  mel: 'theme' | 'bridge' | null; melBars?: [number, number];   // chỉ phát các ô (tính trong câu 8 ô) thuộc [từ, đến)
  lead: number; pluck: number; bell: number;  // lực các tiếng mang giai điệu (0 = không chơi)
  arp: number; stab: number; pad: number;
  counter?: number;                           // bè dây đối đáp từ ô này trở đi
  double?: boolean;                           // giai điệu thêm quãng tám trên
  crash?: boolean; fill?: boolean; riser?: boolean;   // chũm chọe đầu đoạn; trống dồn / tiếng dâng ở ô cuối
}
export const SECTIONS: Section[] = [
  { name: 'invitation', bars: 4, prog: 'main', drums: 'none', bass: 'long', mel: 'theme', melBars: [0, 4], lead: 0, pluck: 1, bell: 0.7, arp: 0.7, stab: 0, pad: 0.85, riser: true },
  { name: 'journey', bars: 8, prog: 'main', drums: 'pulse', bass: 'pulse', mel: 'theme', melBars: [4, 8], lead: 0.4, pluck: 0.9, bell: 0.4, arp: 0.85, stab: 0.45, pad: 0.9, fill: true, riser: true },
  { name: 'theme', bars: 16, prog: 'main', drums: 'drive', bass: 'pulse', mel: 'theme', lead: 1, pluck: 0.7, bell: 0.3, arp: 0.9, stab: 0.8, pad: 1, counter: 8, crash: true, fill: true },
  { name: 'breath', bars: 8, prog: 'alt', drums: 'none', bass: 'long', mel: 'theme', lead: 0, pluck: 1, bell: 0.7, arp: 0.45, stab: 0, pad: 0.9 },
  { name: 'lift', bars: 4, prog: 'lift', drums: 'pulse', bass: 'pulse', mel: null, lead: 0, pluck: 0, bell: 0, arp: 1, stab: 0.6, pad: 0.95, fill: true, riser: true },
  { name: 'summit', bars: 16, prog: 'main', drums: 'drive', bass: 'pulse', mel: 'theme', lead: 1, pluck: 0.7, bell: 0.45, arp: 1, stab: 0.9, pad: 1, counter: 0, double: true, crash: true, fill: true },
  { name: 'discover', bars: 8, prog: 'bridge', drums: 'half', bass: 'pulse', mel: 'bridge', lead: 0.9, pluck: 0.6, bell: 0.3, arp: 0.8, stab: 0.5, pad: 1, crash: true, fill: true },
  { name: 'return', bars: 8, prog: 'main', drums: 'drive', bass: 'pulse', mel: 'theme', lead: 1, pluck: 0.7, bell: 0.4, arp: 0.9, stab: 0.8, pad: 1, counter: 0, crash: true },
  { name: 'horizon', bars: 4, prog: 'main', drums: 'pulse', bass: 'pulse', mel: 'theme', melBars: [0, 2], lead: 0, pluck: 0.8, bell: 0.7, arp: 0.7, stab: 0, pad: 0.9, crash: true },
  { name: 'turn', bars: 4, prog: 'main', progAt: 4, drums: 'none', bass: 'long', mel: null, lead: 0, pluck: 0, bell: 0, arp: 0.55, stab: 0, pad: 0.8, riser: true }
];
export const TOTAL_BARS = SECTIONS.reduce((s, x) => s + x.bars, 0);

/* Giai điệu của một ô: bảng tra theo bước cho câu 8 ô */
export function melodyIndex(notes: Note[]): Map<number, Note[]> {
  const m = new Map<number, Note[]>();
  for (const n of notes) { const a = m.get(n[0]); if (a) a.push(n); else m.set(n[0], [n]); }
  return m;
}
export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/* Các nốt của hợp âm xếp đi lên từ `from` (MIDI), lấy `n` nốt: dùng cho rải, đệm, bè dây */
export function chordNotes(c: Chord, from: number, n: number): number[] {
  const out: number[] = [];
  for (let m = from; out.length < n && m < from + 48; m++) if (c.tones.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}
/* Nốt hợp âm (ba nốt đầu) gần `target` nhất */
export function nearestTone(c: Chord, target: number): number {
  let best = target, d = 99;
  for (let m = target - 6; m <= target + 6; m++) if (c.tones.slice(0, 3).includes(((m % 12) + 12) % 12) && Math.abs(m - target) < d) { best = m; d = Math.abs(m - target); }
  return best;
}
