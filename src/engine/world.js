// ============================================================================
// THE WORLD (the school as a place)
// ----------------------------------------------------------------------------
// Turns the raw numbers in data/skool.js into objects with helpful questions:
// "which floor is this character on?", "is there a wall in front of them?",
// "which staircase gets me from here to there?", "is this a chair?".
//
// It also owns the doors (open/shut), the blackboards (what's written on
// them), the cups (what's in them), the desks (what's hidden in them), the
// "signals" characters use to coordinate (e.g. BlueRoomReady), and Eric's
// "home room" for the current period.
// ============================================================================

import { SKOOL } from '../data/skool.js';

// ---- Small geometry classes --------------------------------------------------

export class Floor {
  constructor({ id, minX, maxX, y }) { Object.assign(this, { id, minX, maxX, y }); }
  supports(c) { return this.y === c.y && this.minX <= c.x && c.x <= this.maxX; }
  below(c) { return this.y >= c.y && this.minX <= c.x && c.x <= this.maxX; }
  containsLocation(x, y) { return this.y === y && this.minX <= x && x <= this.maxX; }
}

export class Staircase {
  constructor({ id, alias, bottom, top, force }) {
    this.id = id; this.alias = alias;
    this.bottom = { x: bottom[0], y: bottom[1] };
    this.top = { x: top[0], y: top[1] };
    this.force = !!force;
    this.direction = this.bottom.x < this.top.x ? 1 : -1;  // which way "up" is
  }
  // On a step, or at the bottom facing up, or at the top facing down.
  contains(c, distance = 0) {
    for (let d = 0; d <= distance; d++) {
      const x = c.x + d * c.direction, y = c.y;
      if (this.containsLocation(x, y)) {
        if (x === this.bottom.x) return c.direction === this.direction;
        if (x === this.top.x) return c.direction !== this.direction;
        return true;
      }
    }
    return false;
  }
  containsLocation(x, y) {
    const d = this.direction;
    if (d * this.bottom.x <= d * x && d * x <= d * this.top.x) {
      if ((x === this.bottom.x && y === this.bottom.y) || (x === this.top.x && y === this.top.y)) return true;
      if (this.top.y < y && y < this.bottom.y) return x === this.bottom.x + d * (this.bottom.y - y);
    }
    return false;
  }
  supports(c) {
    if (!this.containsLocation(c.x, c.y)) return false;
    return !((c.x === this.bottom.x && c.y === this.bottom.y) || (c.x === this.top.x && c.y === this.top.y));
  }
}

// A wall, door or window: something that can stop you walking.
export class Barrier {
  constructor({ id, x, bottomY, topY, climb, fly }) {
    Object.assign(this, { id, x, bottomY, topY, climbPhases: climb, flyPhases: fly });
  }
  isShut() { return true; }
  isDoor() { return false; }
  impedes(c, distance = 0, forceShut = false) {
    if (!(forceShut || this.isShut())) return false;
    if (c.impeded(this.bottomY, this.topY)) {
      if (c.x < this.x && c.direction > 0) return c.x + distance >= this.x - c.width + 1;
      if (c.x >= this.x && c.direction < 0) return c.x - distance <= this.x;
    }
    return false;
  }
}

export class Wall extends Barrier {
  // Does this wall block the view between two points?
  separates(a, b) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    if (minX < this.x && this.x <= maxX) {
      return this.topY <= Math.max(a.y, b.y) && this.bottomY >= Math.min(a.y, b.y);
    }
    return false;
  }
}

export class Door extends Barrier {
  constructor(spec) {
    super(spec);
    this.shut = this.initiallyShut = !!spec.shut;
    this.autoShutDelay = spec.autoShutDelay || 0;
    this.autoShutTimer = 0;
    this.coords = spec.coords; this.size = spec.size;
  }
  isShut() { return this.shut; }
  isDoor() { return true; }
  move(shut) {
    this.shut = shut;
    if (!shut) this.autoShutTimer = this.autoShutDelay;
  }
  autoShut() {
    if (this.shut || this.autoShutDelay < 1) return false;
    this.autoShutTimer = Math.max(this.autoShutTimer - 1, 0);
    return this.autoShutTimer === 0;
  }
}

export class Window extends Door {
  constructor(spec) {
    super({ ...spec, autoShutDelay: 0, climb: spec.descent });
    this.openerCoords = spec.openerCoords;
    this.notABird = spec.notABird || null;
  }
}

export class Chair {
  constructor(room, x) { this.room = room; this.x = x; this.occupant = null; }
  seat(c) { this.occupant = c; }
  vacate() { this.occupant = null; }
}

export class Desk {
  constructor(room, x) { this.room = room; this.x = x; this.contents = null; }
  insert(item) { this.contents = item; }
  empty() { this.contents = null; }
}

export class Blackboard {
  constructor(room, topLeft, size) {
    this.room = room;
    this.x = topLeft[0]; this.y = topLeft[1];
    this.width = size[0]; this.height = size[1];
    this.rightX = this.x + this.width - 1;
    this.clear();
  }
  // measureFn tells us how wide text is so we can wrap to the second line.
  write(char, measureFn) {
    if (this.lines.length) {
      if (this.lines.length === 1 && measureFn && measureFn(this.lines[0] + char) > this.width * 8 - 2) this.newline();
      this.lines[this.lines.length - 1] += char;
    } else {
      this.lines.push(char);
    }
    this.version++;
  }
  newline() { if (this.lines.length < this.height) this.lines.push(''); }
  wipe(column) {
    this.wipedColumns.add(column);
    this.version++;
    if (this.wipedColumns.size === this.width) this.clear();
  }
  isDirty() { return this.lines.length > 0 && this.lines[0].length > 0; }
  clear() { this.lines = []; this.writer = null; this.wipedColumns = new Set(); this.version = (this.version || 0) + 1; }
  // Is a character standing beside this board (arm within its width)?
  beside(c) {
    const armX = c.x + c.direction + 1;
    return this.x + 1 <= armX && armX <= this.x + this.width - 2;
  }
  // Does the first line show this text? inOrder=false means "same letters,
  // any order" (how the bike/storeroom combinations are checked).
  shows(text, inOrder = true) {
    if (!this.lines.length) return false;
    const first = this.lines[0].toLowerCase();
    const target = text.toLowerCase();
    if (inOrder) return first.startsWith(target);
    let source = first.slice(0, target.length);
    if (source.length !== target.length) return false;
    let t = target;
    while (source) {
      const i = t.indexOf(source[0]);
      if (i < 0) return false;
      t = t.slice(0, i) + t.slice(i + 1);
      source = source.slice(1);
    }
    return true;
  }
}

export class Room {
  constructor({ id, name, topLeft, bottomRight, getAlong }) {
    this.id = id; this.name = name;
    this.minX = topLeft[0]; this.minY = topLeft[1];
    this.maxX = bottomRight[0]; this.maxY = bottomRight[1];
    this.getAlong = getAlong;
    this.chairs = []; this.desks = []; this.blackboard = null;
  }
  contains(c) {
    if (this.minY <= c.y && c.y <= this.maxY - c.height + 1) return this.minX <= c.x && c.x <= this.maxX;
    return false;
  }
  hasBlackboard() { return !!this.blackboard; }
  blackboardDirty() { return this.blackboard ? this.blackboard.isDirty() : false; }
  getBlackboardWriter() { return this.blackboard?.writer || null; }
  besideBlackboard(c) {
    if (!this.blackboard) return false;
    return (this.maxY - c.height + 1) === c.y && this.blackboard.beside(c);
  }
  // Chairs face the blackboard: -1 if the first chair is left of the last.
  chairDirection() {
    if (!this.chairs.length) return null;
    return this.chairs[0].x < this.chairs[this.chairs.length - 1].x ? -1 : 1;
  }
  chair(c, checkDir = true) {
    const dir = this.chairDirection();
    const floorY = this.maxY - c.height + 1;
    for (const chair of this.chairs) {
      if ((!checkDir || c.direction === dir) && c.x === chair.x && c.y === floorY) return chair;
    }
    return null;
  }
  desk(c) {
    if (!c.isSittingOnChair()) return null;
    const floorY = this.maxY - c.height + 1;
    for (const desk of this.desks) if (c.x === desk.x && c.y === floorY) return desk;
    return null;
  }
  // Which chair should this character head for?
  getNextChair(c, moveAlong, goToBack) {
    if (!this.chairs.length) return [null, null];
    const front = this.chairs[0], back = this.chairs[this.chairs.length - 1];
    const dir = this.chairDirection();
    if (goToBack) return [back, dir];
    if (c.direction !== dir || (moveAlong && front.x === c.x)) return [back, dir];
    let min = 1000, next = back;
    for (const chair of this.chairs) {
      const distance = (chair.x - c.x) * dir;
      if (distance === 0 && moveAlong) continue;
      if (0 <= distance && distance < min) { min = distance; next = chair; }
    }
    return [next, dir];
  }
}

export class Cup {
  constructor({ id, x, y }) { Object.assign(this, { id, x, y }); this.contents = null; this.frogs = []; }
  isEmpty() { return !this.contents && this.frogs.length === 0; }
  fill(contents) { this.contents = contents; }
}

export class NoGoZone {
  constructor(spec) { Object.assign(this, spec); }
  contains(x, y) { return this.minX <= x && x <= this.maxX && this.topY <= y && y <= this.bottomY; }
}

// ---- The world itself --------------------------------------------------------

export class World {
  constructor(data = SKOOL) {
    this.data = data;
    this.width = data.width; this.height = data.height;
    this.playground = data.playground;

    this.walls = data.walls.map((w) => new Wall(w));
    this.doors = new Map(data.doors.map((d) => [d.id, new Door(d)]));
    this.windows = new Map(data.windows.map((w) => [w.id, new Window(w)]));
    this.barriers = [...this.walls, ...this.doors.values(), ...this.windows.values()];
    this.floors = data.floors.map((f) => new Floor(f));
    this.staircases = new Map();
    for (const s of data.staircases) {
      const sc = new Staircase(s);
      this.staircases.set(s.id, sc);
      if (s.alias) this.staircases.set(s.alias, sc);
    }
    this.routes = data.routes;
    this.rooms = new Map(data.rooms.map((r) => [r.id, new Room(r)]));
    for (const b of data.blackboards) {
      const room = this.rooms.get(b.room);
      room.blackboard = new Blackboard(room, b.topLeft, b.size);
    }
    for (const [roomId, xs] of Object.entries(data.chairs)) xs.forEach((x) => this.rooms.get(roomId).chairs.push(new Chair(this.rooms.get(roomId), x)));
    for (const [roomId, xs] of Object.entries(data.desks)) xs.forEach((x) => this.rooms.get(roomId).desks.push(new Desk(this.rooms.get(roomId), x)));
    this.noGoZones = data.noGoZones.map((z) => new NoGoZone(z));
    this.cups = new Map(data.cups.map((c) => [c.id, new Cup(c)]));
    this.plantPots = data.plants.map((p) => ({ id: p.id, x: p.x, y: p.y, plant: null }));
    this.locations = data.locations;
    this.safe = data.safe;
    this.animationPhases = data.animationPhases;
    this.windowProximity = 16;

    this.signals = new Set();
    this.homeRoom = null;
    this.bikeCombination = null;
    this.storeroomCombination = null;
  }

  // ---- Geometry questions ----------------------------------------------------
  floor(thing) { return this.floors.find((f) => f.supports(thing)) || null; }
  floorBelow(c) {
    let best = null;
    for (const f of this.floors) if (f.below(c) && (!best || f.y < best.y)) best = f;
    return best;
  }
  onFloor(c) { return this.floors.some((f) => f.supports(c)); }
  floorAt(x, y) { return this.floors.find((f) => f.containsLocation(x, y)) || null; }
  staircase(c, distance = 0) {
    for (const s of new Set(this.staircases.values())) if (s.contains(c, distance)) return s;
    return null;
  }
  onStaircase(c) { for (const s of new Set(this.staircases.values())) if (s.supports(c)) return true; return false; }
  barrier(c, distance = 0) { return this.barriers.find((b) => b.impedes(c, distance)) || null; }
  room(c) { for (const r of this.rooms.values()) if (r.contains(c)) return r; return null; }
  getRoom(id) { return this.rooms.get(id) || null; }
  getDoor(id) { return this.doors.get(id) || this.windows.get(id) || null; }
  chair(c, checkDir = true) { for (const r of this.rooms.values()) { const ch = r.chair(c, checkDir); if (ch) return ch; } return null; }
  desk(c) { for (const r of this.rooms.values()) { const d = r.desk(c); if (d) return d; } return null; }
  cup(x, y) { for (const cup of this.cups.values()) if (cup.x === x && cup.y === y) return cup; return null; }
  plantPot(x, y) { return this.plantPots.find((p) => p.x === x && p.y === y) || null; }
  inNoGoZone(x, y) { return this.noGoZones.some((z) => z.contains(x, y)); }
  inPlayground(c) { return this.playground[0] <= c.x && c.x <= this.playground[1]; }
  lineOfSightBetween(a, b) { return !this.walls.some((w) => w.separates(a, b)); }
  window(c) { for (const w of this.windows.values()) if (w.impedes(c, 0, true)) return w; return null; }
  nearbyWindow(c) {
    for (const w of this.windows.values()) {
      const [x, y] = w.openerCoords;
      if (c.y === y && Math.abs(c.x - x) <= this.windowProximity) return w;
    }
    return null;
  }
  visibleBlackboard(c) {
    for (const r of this.rooms.values()) {
      const b = r.blackboard;
      if (b && b.y <= c.y && c.y <= b.y + 2 && c.isFacing(b) && this.lineOfSightBetween(c, b)) return b;
    }
    return null;
  }
  besideBlackboard(c) { for (const r of this.rooms.values()) if (r.besideBlackboard(c)) return true; return false; }

  // Which staircase next, to get from one floor to another?
  nextStaircase(homeFloor, destFloor) {
    if (!homeFloor || !destFloor || homeFloor === destFloor) return null;
    const routes = this.routes[homeFloor.id];
    const id = routes[destFloor.id] || routes['*'];
    return this.staircases.get(id);
  }

  resolveLocationId(id) {
    const loc = this.locations[id];
    return loc ? { x: loc[0], y: loc[1] } : null;
  }

  // ---- Doors -----------------------------------------------------------------
  isDoorShut(id) { const d = this.getDoor(id); return d ? d.isShut() : false; }
  moveDoor(id, shut) { const d = this.getDoor(id); if (d) d.move(shut); return d; }
  autoShutDoors() { for (const d of this.doors.values()) if (d.autoShut()) d.move(true); }

  // ---- Safe, cabinet, cups, desks -------------------------------------------
  isSafeAt(x, y) { return this.safe.x === x && this.safe.y === y; }
  isOpenDrinksCabinetAt(x, y) {
    const d = this.doors.get('DrinksCabinet');
    return d && !d.shut && d.coords[0] === x && d.coords[1] === y;
  }
  fillCup(cupId, contents) { this.cups.get(cupId).fill(contents); }
  allDesks() { const out = []; for (const r of this.rooms.values()) out.push(...r.desks); return out; }
  fillDesks(rng) {
    const desks = this.allDesks();
    desks.forEach((d) => d.empty());
    const shuffled = rng.shuffle(desks);
    shuffled[0]?.insert('WATER_PISTOL');
    shuffled[1]?.insert('STINKBOMBS3');
  }
  hideInDesk(item, rng) {
    for (const d of rng.shuffle(this.allDesks())) if (!d.contents) { d.insert(item); return; }
  }
  gotBikeCombination(board) { return this.bikeCombination && board.shows(this.bikeCombination, false); }
  gotStoreroomCombination(board) { return this.storeroomCombination && board.shows(this.storeroomCombination, false); }

  // ---- Signals (how characters coordinate) ----------------------------------
  signal(s) { this.signals.add(s); }
  unsignal(s) { this.signals.delete(s); }
  gotSignal(s) { return this.signals.has(s); }
  clearSignals() { this.signals.clear(); }

  // ---- Eric's home room ------------------------------------------------------
  setHomeRoom(roomId) { this.homeRoom = this.getRoom(roomId); }
  unsetHomeRoom() { this.homeRoom = null; }
}
