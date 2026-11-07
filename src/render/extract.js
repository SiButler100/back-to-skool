// ============================================================================
// EXTRACTING THE ORIGINAL GRAPHICS FROM YOUR OWN COPY OF THE GAME
// ----------------------------------------------------------------------------
// This project ships no copyrighted artwork. To see the 1985 graphics you
// load your own copy of Back to Skool: a tape image (.tzx) or a snapshot
// (.z80 or .sna). This module reads the Spectrum's memory out of that file
// and rebuilds every picture the game draws, following the same recipe as
// Richard Dymond's Pyskool (the addresses below are from his work):
//
//   skool       the whole school backdrop, 1536 x 168
//   sprites     128 pictures of people and things, 16 per row, 24 x 32
//   mutables    doors, windows, cups and the bike in their two or three states
//   font        the proportional font, 8 px tall
//   bubble, inventory, scorebox, logo
//   attributes  the ink/paper colour byte of each of the 192 x 21 cells
//
// Everything is produced as plain RGBA pixel arrays, so it runs in a browser
// or in Node (the tests compare it against a known-good extraction).
// ============================================================================

// ---- 1. Reading a file into 64K of Spectrum memory --------------------------

export function loadSnapshot(bytes, filename) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ext = filename.toLowerCase().slice(-4);
  let ram;
  if (ext === '.sna') ram = data.slice(27, 27 + 49152);
  else if (ext === '.z80') ram = readZ80(data);
  else if (ext === '.tzx') ram = readTzx(data);
  else throw new Error(`Unknown file type "${ext}". Use a .tzx, .z80 or .sna file.`);
  if (ram.length !== 49152) throw new Error(`Unexpected RAM size ${ram.length}`);
  const mem = new Uint8Array(65536);
  mem.set(ram, 16384);
  return mem;
}

function readZ80(data) {
  const version = (data[6] + data[7]) > 0 ? 1 : 2;
  const headerSize = version === 1 ? 30 : 32 + data[30];
  if (version === 1) {
    const body = data.slice(headerSize, data.length - 4);
    return (data[12] & 32) === 0 ? data.slice(headerSize, headerSize + 49152) : decompressBlock(body);
  }
  const machineId = data[34];
  const v = data[30] === 23 ? 2 : 3;
  let banks, extension = null;
  if ((v === 2 && machineId < 2) || (v === 3 && [0, 1, 3].includes(machineId))) {
    if (data[37] & 128) { banks = [5]; extension = new Uint8Array(32768); } else banks = [5, 1, 2];
  } else {
    banks = [5, 2, data[35] & 7];
  }
  return decompress(data.slice(headerSize), banks, extension);
}

function decompress(ramz, banks, extension) {
  const pages = {};
  let j = 0;
  while (j < ramz.length) {
    const length = ramz[j] + 256 * ramz[j + 1];
    const page = ramz[j + 2] - 3;
    if (length === 65535) { pages[page] = ramz.slice(j + 3, j + 3 + 16384); j += 3 + 16384; }
    else { pages[page] = decompressBlock(ramz.slice(j + 3, j + 3 + length)); j += 3 + length; }
  }
  const out = new Uint8Array(49152);
  let off = 0;
  for (const b of banks) { out.set(pages[b] || new Uint8Array(16384), off); off += 16384; }
  if (extension) out.set(extension, 16384);
  return out;
}

function decompressBlock(ramz) {
  const out = [];
  let i = 0;
  while (i < ramz.length) {
    const b = ramz[i++];
    if (b === 237) {
      const c = ramz[i++];
      if (c === 237) {
        const count = ramz[i], value = ramz[i + 1];
        for (let k = 0; k < count; k++) out.push(value);
        i += 2;
      } else out.push(b, c);   // a lone ED is literal, and so is the byte after it
    } else out.push(b);
  }
  return Uint8Array.from(out);
}

// A TZX holds the tape; the game's loader puts the big turbo block in memory
// in a particular scrambled order, which we reproduce here.
function readTzx(data) {
  const sig = String.fromCharCode(...data.slice(0, 7));
  if (sig !== 'ZXTape!') throw new Error('Not a TZX file');
  let i = 10, program = '';
  while (i < data.length) {
    const [next, id, block] = tzxBlock(data, i);
    i = next;
    if (id === 16 && block[0] === 0) {
      program = String.fromCharCode(...block.slice(2, 12)).trim();
      if (program !== 'bak2skool' && program !== 'skooldaze') throw new Error(`This tape is "${program}", not Back to Skool`);
    } else if (program && id === 17) {
      if (block.length !== 82109) throw new Error(`Unexpected data block length ${block.length}`);
      return tzxToRam(block);
    }
  }
  throw new Error('Could not find the game data on this tape');
}

function tzxToRam(d) {
  const snap = new Uint8Array(65536);
  snap.set(d.slice(1, 16571), 16384);
  let j = 32902;
  for (let k = 16571; k < 82109; k++) { snap[j] = d[k]; j = (j + 23) % 65536; }
  if (snap[16384] === 255) {   // Skool Daze
    snap.set(snap.slice(32256, 32768), 32768);
    snap[32612] = 0; snap[32613] = 0;
  } else {                      // Back to Skool
    snap.set(snap.slice(58112, 58368), 32768);
    snap.set(snap.slice(23296, 23552), 33024);
  }
  return snap.slice(16384);
}

function tzxBlock(data, i) {
  const w = (k) => data[k] + 256 * data[k + 1];
  const w3 = (k) => w(k) + 65536 * data[k + 2];
  const dw = (k) => w3(k) + 16777216 * data[k + 3];
  const id = data[i]; i += 1;
  let block = new Uint8Array(0);
  switch (id) {
    case 16: { const len = w(i + 2); block = data.slice(i + 4, i + 4 + len); i += 4 + len; break; }
    case 17: { const len = w3(i + 15); block = data.slice(i + 18, i + 18 + len); i += 18 + len; break; }
    case 18: i += 4; break;
    case 19: i += 2 * data[i] + 1; break;
    case 20: i += w3(i + 7) + 10; break;
    case 21: i += w3(i + 5) + 8; break;
    case 24: case 25: i += dw(i) + 4; break;
    case 32: case 35: case 36: i += 2; break;
    case 33: case 48: i += data[i] + 1; break;
    case 34: case 37: case 39: break;
    case 38: i += w(i) * 2 + 2; break;
    case 40: case 50: i += w(i) + 2; break;
    case 42: i += 4; break;
    case 43: i += 5; break;
    case 49: i += data[i + 1] + 2; break;
    case 51: i += data[i] * 3 + 1; break;
    case 53: i += dw(i + 16) + 20; break;
    case 90: i += 9; break;
    default: throw new Error(`Unknown TZX block ${id}`);
  }
  return [i, id, block];
}

// ---- 2. Colours --------------------------------------------------------------

const NORMAL = [[0, 0, 0], [0, 0, 197], [197, 0, 0], [197, 0, 197], [0, 198, 0], [0, 198, 197], [197, 198, 0], [205, 198, 205]];
const BRIGHT = [[0, 0, 0], [0, 0, 255], [255, 0, 0], [255, 0, 255], [0, 255, 0], [0, 255, 255], [255, 255, 0], [255, 255, 255]];
function inkRGB(attr) { return (attr & 64 ? BRIGHT : NORMAL)[attr & 7]; }
function paperRGB(attr) { return (attr & 64 ? BRIGHT : NORMAL)[(attr >> 3) & 7]; }

// An 8x8 character cell: attribute byte, 8 bitmap bytes, optional mask.
class Udg {
  constructor(attr, data, mask = null) { this.attr = attr; this.data = Array.from(data); this.mask = mask ? Array.from(mask) : null; }
}
const BLANK = () => new Udg(0, [0, 0, 0, 0, 0, 0, 0, 0]);

// An RGBA bitmap we can draw UDG arrays into.
class Bitmap {
  constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
  set(x, y, rgb, a = 255) { const i = (y * this.width + x) * 4; this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2]; this.data[i + 3] = a; }
}

// Paint a 2-D array of UDGs. With useMask, a clear pixel under a set mask bit
// is transparent (that is how sprites keep their outline).
function paintUdgs(udgs, { useMask = false, inkOverride = null, paperAlpha = 255 } = {}) {
  const rows = udgs.length, cols = Math.max(...udgs.map((r) => r.length));
  const bm = new Bitmap(cols * 8, rows * 8);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < udgs[r].length; c++) {
      const u = udgs[r][c];
      if (!u) continue;
      const ink = inkOverride || inkRGB(u.attr), paper = paperRGB(u.attr);
      for (let y = 0; y < 8; y++) {
        let byte = u.data[y];
        let maskByte = useMask && u.mask ? u.mask[y] : 0;
        if (useMask && u.mask) byte &= maskByte;
        for (let x = 0; x < 8; x++) {
          const px = c * 8 + x, py = r * 8 + y;
          if (byte & 128) bm.set(px, py, ink);
          else if ((maskByte & 128) === 0) bm.set(px, py, paper, paperAlpha);
          byte = (byte << 1) & 255; maskByte = (maskByte << 1) & 255;
        }
      }
    }
  }
  return bm;
}

// ---- 3. Reading the game's own graphics tables ----------------------------

export class BackToSkoolMemory {
  constructor(mem) { this.m = mem; }

  // One cell of the school backdrop at column x, row y.
  skoolUdg(y, x) {
    const m = this.m;
    const q = m[x + 46336];
    const h = y + 160;
    const hl = 180 + (q >> 1) + 256 * h;
    let i = 0;
    let p = (q & 1) ? (m[hl] & 15) : (m[hl] >> 4);
    if (p === 0) {
      i = (q & 3) || 2;
      p = (q & 1) ? (m[hl + 256] & 15) : (m[hl + 256] >> 4);
    }
    const attr = i | (8 * p);
    const ref = m[q + 256 * h];
    const a = (136 >> (q & 3)) & m[144 + (q >> 2) + 256 * h];
    const udgPage = ((a & 15) ? 8 : 0) + ((a & 240) ? 144 : 128);
    const addr = ref + 256 * udgPage;
    const bytes = [];
    for (let k = 0; k < 8; k++) bytes.push(m[addr + 256 * k]);
    return new Udg(attr, bytes);
  }
  skoolUdgs(x, y, w, h) {
    const out = [];
    for (let row = y; row < y + h; row++) { const r = []; for (let col = x; col < x + w; col++) r.push(this.skoolUdg(row, col)); out.push(r); }
    return out;
  }

  // Apply a "mutable" table (open/shut a door, fill a cup...) to the school
  // data in memory and return the cells it touched.
  alterSkoolUdgs(address) {
    const m = this.m;
    const coords = [];
    for (;;) {
      const y = m[address];
      if (y === 255) break;
      const x = m[address + 1];
      coords.push([x, y]);
      const udgLsb = m[address + 2], attr = m[address + 3];
      const d = y + 160;
      const colRef = m[x + 46336];
      m[colRef + 256 * d] = udgLsb;
      const z = 1 << (colRef & 3);
      let e = 128 + ((colRef + 104) >> 1);
      let a = m[e + 256 * d];
      if (colRef & 1) a = (a & 240) | (attr & 15); else a = (16 * (attr & 15)) | (a & 15);
      m[e + 256 * d] = a;
      a = attr & 192;
      if (a & 64) a -= 56;
      e = 144 + (colRef >> 2);
      m[e + 256 * d] = (m[e + 256 * d] & (255 - Math.floor(136 / z))) | Math.floor(a / z);
      address += 4;
    }
    return coords;
  }
  mutableUdgArray(address) {
    const coords = this.alterSkoolUdgs(address);
    const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
    const left = Math.min(...xs), top = Math.min(...ys);
    return this.skoolUdgs(left, top, Math.max(...xs) - left + 1, Math.max(...ys) - top + 1);
  }

  fixGraphicGlitches() {
    // Small corrections to glitches in the original graphics data (Pyskool's list).
    const fixes = [[59001, 204], [47249, 252], [47254, 255], [47265, 255], [53356, 171], [53896, 228], [53461, 95], [53973, 95], [54485, 223], [54487, 250], [51417, 235],
      [50281, 222], [49864, 239], [50877, 238], [47209, 231], [53853, 223], [54865, 127], [52316, 191], [54876, 191], [52089, 30], [52345, 222],
      [51644, 232], [51900, 232], [52668, 36], [52924, 164], [53180, 44], [53436, 172], [53692, 46], [53948, 174], [54204, 54], [54460, 182], [54716, 53], [54972, 181]];
    for (const [a, v] of fixes) this.m[a] = v;
  }
  initialiseMutables() {
    for (const a of [64000, 57405, 57856, 55040, 55552, 56064, 56637, 57088, 56576, 56081, 56337]) this.alterSkoolUdgs(a);
  }
  wipeBlackboards() { for (let i = 32768; i < 34816; i += 256) this.m.fill(255, i, i + 80); }

  playArea() { this.initialiseMutables(); this.wipeBlackboards(); return this.skoolUdgs(0, 0, 192, 21); }

  // Sprites: 4 rows x 3 columns of cells per picture, with a mask.
  spriteUdg(state, attr, row, col) {
    const m = this.m;
    const asNorm = state | 128;
    const udgPage = asNorm < 208 ? 183 : 199;
    const c = (state & 128) ? 2 - col : col;
    const refPage = 215 + c * 4 + row;
    const ref = m[asNorm + 256 * refPage];
    let data, mask;
    if (ref === 0) { data = [0, 0, 0, 0, 0, 0, 0, 0]; mask = [255, 255, 255, 255, 255, 255, 255, 255]; }
    else {
      const addr = ref + 256 * udgPage;
      data = []; mask = [];
      for (let k = 0; k < 8; k++) { data.push(m[addr + 512 * k]); mask.push(m[addr + 256 + 512 * k]); }
    }
    const udg = new Udg(attr, data, mask);
    if (state === 81 && row === 3 && col === 2) { udg.mask[0] = 127; udg.mask[1] = 127; udg.data[4] = udg.data[5] = udg.data[6] = 192; udg.mask[4] = udg.mask[5] = udg.mask[6] = 223; }
    return udg;
  }
  buildSprite(state, attr) {
    const rows = [];
    for (let r = 0; r < 4; r++) { const row = []; for (let c = 0; c < 3; c++) row.push(this.spriteUdg(state, attr, r, c)); rows.push(row); }
    return rows;
  }
  animatoryStates() {
    this.fixGraphicGlitches();
    const montage = [];
    for (let y = 0; y < 8; y++) {
      montage.push([], [], [], []);
      for (let x = 0; x < 16; x++) {
        const sprite = this.buildSprite(x + 16 * y, 120);
        sprite.forEach((row, i) => montage[4 * y + i].push(...row));
      }
    }
    // Pixels that should show through (fixing glitches in the original masks)
    const coords = [
      [10, 7], [10, 55], [10, 103], [10, 175], [10, 199], [10, 223], [10, 247],
      [11, 7], [11, 55], [11, 103], [11, 175], [11, 199], [11, 223], [11, 247],
      [12, 7], [12, 55], [12, 103], [12, 175], [12, 199], [12, 223], [12, 247],
      [13, 7], [13, 55], [13, 103], [13, 175], [13, 199], [13, 247],
      [14, 7], [14, 55], [14, 103], [14, 199], [14, 247],
      [41, 7], [41, 55], [41, 103], [41, 175], [41, 247], [41, 271],
      [43, 7], [43, 55], [43, 103], [43, 175], [43, 247],
      [44, 7], [44, 55], [44, 103], [44, 175], [44, 247],
      [45, 7], [45, 55], [45, 103], [45, 175], [45, 247],
      [46, 7], [46, 55], [46, 103], [46, 247],
      [73, 7], [73, 55], [73, 103], [73, 199], [73, 223],
      [152, 27], [191, 55], [239, 233], [239, 281], [253, 88], [254, 88],
    ];
    addTransparency(montage, coords);
    montage[5][44].mask[6] &= 127;   // end of the frog's leg
    return montage;
  }

  udg(address, attr) { return new Udg(attr, this.m.slice(address, address + 8)); }
  boxGraphic(address) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const attr = this.m[address + 8 * r + c];
        const start = address + 24 + 64 * r + c;
        const data = []; for (let k = 0; k < 8; k++) data.push(this.m[start + 8 * k]);
        row.push(new Udg(attr, data));
      }
      rows.push(row);
    }
    return rows;
  }
  bubbleUdgs() {
    const attr = 56;
    const top = [39392, 39648, 39648, 39648, 39648, 39648, 39648, 39904].map((a) => this.udg(a, attr));
    const bottom = [40160, 40416, 40416, 40416, 40416, 40416, 40416, 40672].map((a) => this.udg(a, attr));
    top.push(this.udg(39136, attr)); bottom.push(BLANK());
    const udgs = [top, bottom];
    addTransparency(udgs, [[0, 0], [0, 63], [2, 64], [3, 64], [3, 71], [4, 64], [4, 71], [5, 64], [5, 65], [5, 71], [6, 64], [6, 65], [6, 71], [7, 64], [7, 65], [7, 66], [7, 70], [7, 71], [15, 0], [15, 63]]);
    return udgs;
  }
  inventoryUdgs() {
    const items = [[[39144], 6], [[39400], 7], [[39656], 4], [[39912, 40168], 5], [[39912, 40168], 3], [[40424], 7], [[40680], 7], [[40936], 7], [[40928], 7]];
    const row = [];
    for (const [addrs, attr] of items) for (const a of addrs) row.push(this.udg(a, attr));
    return [row];
  }
  mutableUdgs() {
    const sheet = Array.from({ length: 14 }, () => Array(18).fill(null));
    const blit = (udgs, x, y) => udgs.forEach((row, i) => row.forEach((u, j) => { sheet[y + i][x + j] = u; }));
    const pair = (addr, x, y) => { blit(this.mutableUdgArray(addr), x, y); return this.mutableUdgArray(addr + 256); };
    blit(pair(56637, 0, 0), 3, 0);      // left study door (shut, open)
    blit(pair(57088, 6, 0), 9, 0);      // right study door
    blit(pair(56576, 12, 0), 15, 0);    // science lab storeroom door
    blit(pair(57149, 0, 5), 3, 5);      // boys' skool door
    blit(pair(63744, 6, 5), 10, 5);     // skool gate
    blit(pair(56064, 14, 5), 16, 5);    // drinks cabinet
    blit(pair(55040, 0, 10), 3, 10);    // top-floor window
    blit(pair(55552, 6, 10), 8, 10);    // middle-floor window
    blit(pair(57600, 10, 10), 13, 10);  // tree without / with the bike
    const boysEmpty = this.mutableUdgArray(56081);
    blit([[boysEmpty[0][0]]], 14, 7); blit([[boysEmpty[0][2]]], 14, 8);
    blit(this.mutableUdgArray(56337), 14, 9);
    blit(this.mutableUdgArray(56694), 15, 7); blit(this.mutableUdgArray(56950), 15, 8); blit(this.mutableUdgArray(56337 + 1125), 15, 9);
    blit(this.mutableUdgArray(56694 + 5), 16, 7); blit(this.mutableUdgArray(56950 + 5), 16, 8); blit(this.mutableUdgArray(56337 + 1125 + 5), 16, 9);
    for (const row of sheet) for (let i = 0; i < row.length; i++) if (!row[i]) row[i] = BLANK();
    return sheet;
  }
  fontColumns() {
    const cols = [];
    for (let c = 32; c < 128; c++) {
      cols.push(0);
      const width = this.m[55040 + c];
      for (let k = 0; k < width; k++) cols.push(this.m[55296 + c + 256 * k]);
    }
    return cols;
  }
}

function addTransparency(udgs, coords) {
  for (const [y, x] of coords) {
    const u = udgs[y >> 3][x >> 3];
    if (!u.mask) u.mask = u.data.slice();
    u.mask[y & 7] |= 1 << (7 - (x & 7));
  }
}

// ---- 4. The whole set, as RGBA bitmaps ---------------------------------------

export function extractGraphics(mem) {
  const g = new BackToSkoolMemory(new Uint8Array(mem));
  const out = {};
  // Order matters: the sprite fixes patch memory before the school is read.
  out.sprites = paintUdgs(g.animatoryStates(), { useMask: true });
  const play = g.playArea();
  out.skool = paintUdgs(play);
  out.attributes = new Uint8Array(192 * 21);
  play.forEach((row, y) => row.forEach((u, x) => { out.attributes[y * 192 + x] = u.attr; }));
  out.mutables = paintUdgs(g.mutableUdgs());
  out.bubble = paintUdgs(g.bubbleUdgs(), { useMask: true });
  out.inventory = paintUdgs(g.inventoryUdgs(), { paperAlpha: 0 });
  out.scorebox = paintUdgs(g.boxGraphic(58920));
  out.logo = paintUdgs(g.boxGraphic(59176));
  // Font: one bitmap column per entry; ink white on transparent, 8 px tall.
  const cols = g.fontColumns();
  const font = new Bitmap(cols.length, 8);
  cols.forEach((byte, x) => { for (let b = 0; b < 8; b++) if (byte & (1 << b)) font.set(x, 7 - b, [255, 255, 255]); });
  out.font = font;
  return out;
}
