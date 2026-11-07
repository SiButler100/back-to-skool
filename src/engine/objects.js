// ============================================================================
// THINGS THAT MOVE BUT AREN'T PEOPLE
// ----------------------------------------------------------------------------
// Catapult pellets, the jet from the water pistol, drops of water and sherry
// falling from cups, the conker in the tree, the mouse, the frog, the bike,
// the plants, the stinkbomb cloud and the desk lid.
//
// They share a tiny base class (Thing) with a position, a sprite state, a
// visible flag and a fixed command list that runs every tick.
// ============================================================================

import { CommandList } from './commands.js';

export class Thing {
  constructor(id, services, commandList, moveDelay = 1) {
    const { world, cast, game, config, rng } = services;
    Object.assign(this, { id, world, cast, game, config, rng });
    this.name = id;
    this.group = 'OBJ'; this.look = {};     // the sprite painter treats all objects alike
    this.x = -3; this.y = 0; this.direction = -1;
    this.animatoryState = null;
    this.visible = false;
    this.width = 3; this.height = 4;
    this.moveDelay = moveDelay;
    this.delay = 0;
    this.commandList = new CommandList(this);
    this.commandList.setTemplate(commandList);
    this.barrier = null; this.floor = null;
  }
  isEric() { return false; }
  isAdult() { return false; }
  hide() { this.visible = false; this.x = -3; }
  getFloor() { return this.world.floor(this); }
  impeded(bottomY, topY) { return topY - this.height < this.y && this.y <= bottomY; }
  move() {
    this.delay -= 1;
    if (this.delay > 0) return;
    this.delay = this.moveDelay;
    this.barrier = this.visible ? this.world.barrier(this) : null;
    this.floor = this.visible ? this.getFloor() : null;
    this.commandList.command();
  }
}

// ---- Catapult pellet ---------------------------------------------------------
export class Pellet extends Thing {
  constructor(id, services, owner) {
    super(id, services, [['MovePellet']], 1);
    this.owner = owner;
    this.range = 13; this.hitZone = 5; this.hitXY = [1, 1];
    this.width = 1; this.height = 1;
    this.animatoryState = 'FLY';
  }
  impeded(bottomY, topY) { return topY <= this.y + 1 && this.y + 1 <= bottomY; }
  launch(x, y, direction) { this.x = x; this.y = y; this.direction = direction; this.visible = true; this.delay = 1; }
  hitCoords() { return [this.x + this.hitXY[0], this.y + this.hitXY[1]]; }
  getVictim() { return this.cast.getPelletable(this.x, this.y); }
  hitCup() {
    const [hx, hy] = this.hitCoords();
    const cup = this.world.cup(hx, hy);
    if (cup && !cup.isEmpty()) { this.cast.knockCup(cup); return true; }
    return false;
  }
  hitConker() { return this.cast.hitConker(this); }
}

// ---- Water pistol jet --------------------------------------------------------
export class Water extends Thing {
  constructor(id, services, phases) {
    super(id, services, [['MoveWater']], 2);
    this.phases = phases;
    this.liquid = null;
    this.animatoryState = 'WATER0';
  }
  launch(x, y, direction, liquid) {
    this.animatoryState = 'WATER0'; this.x = x; this.y = y; this.direction = direction; this.liquid = liquid; this.visible = true; this.delay = 1;
  }
  hitCup() {
    const x = this.x - (this.direction < 0 ? 1 : -3);
    const cup = this.world.cup(x, this.y);
    if (cup) { this.world.fillCup(cup.id, this.liquid); this.game.events.emit('cup', { cup, contents: this.liquid }); return true; }
    return false;
  }
  hitPlant() {
    const pot = this.world.plantPot(this.x, this.y);
    if (pot) { this.cast.waterPlant(pot, this.liquid); return true; }
    return false;
  }
  hitFloor() { return !!this.floor; }
}

// ---- Falling things: water drop, sherry drop, conker ------------------------
export class Droppable extends Thing {
  constructor(id, services, hitXY, state) {
    super(id, services, [['Fall']], 2);
    this.hitXY = hitXY; this.animatoryState = state; this.width = 1; this.height = 1;
  }
  hitCoords() { return [this.x + this.hitXY[0], this.y + this.hitXY[1] + 1]; }
  fall(x, y) { this.x = x - this.hitXY[0]; this.y = y - this.hitXY[1]; this.visible = true; this.delay = 1; }
}

export class Drop extends Droppable {
  constructor(id, services, liquid) {
    super(id, services, [1, 3], liquid === 'WATER' ? 'WATER_DROP' : 'SHERRY_DROP');
    this.liquid = liquid;
  }
  hitVictim() {
    const [hx, hy] = this.hitCoords();
    const victim = this.liquid === 'WATER' ? this.cast.getWaterable(hx, hy) : this.cast.getSherryable(hx, hy);
    if (victim) {
      if (this.liquid === 'WATER') victim.revealBikeSecret(); else victim.revealStoreroomSecret();
      if (victim.isStanding()) victim.deck();
      this.game.events.emit('splash', { victim, liquid: this.liquid });
      return true;
    }
    return false;
  }
}

export class Conker extends Droppable {
  constructor(id, services, box) {
    super(id, services, [1, 3], 'CONKER');
    this.box = box;   // {minX, maxX, minY, maxY}
  }
  hitBy(pellet) {
    const [px, py] = pellet.hitCoords();
    return !this.visible && this.box.minX <= px && px <= this.box.maxX && this.box.minY <= py && py <= this.box.maxY;
  }
  hitVictim() {
    const [hx, hy] = this.hitCoords();
    const victim = this.cast.getConkerable(hx, hy);
    if (victim && victim.isStanding()) { victim.deck(victim.isVeryConkerable()); this.game.events.emit('conked', { victim }); return true; }
    return false;
  }
}

// ---- Animals -----------------------------------------------------------------
export class Mouse extends Thing {
  constructor(id, services, location, immortal = true) {
    super(id, services, [['MoveMouse', [5, 20], [2, 5], [2, 5], [10, 41]]], 2);
    this.isMouse = true;
    this.immortal = immortal;
    this.spriteXY = [1, 3];
    this.animatoryState = 'RUN';
    [this.x, this.y] = location;
    this.visible = true;
  }
  turn() { this.direction *= -1; }
  isBlocked(distance = 0) {
    if (this.world.barrier(this, distance)) return true;
    const s = this.world.staircase(this, distance);
    return !!(s && s.force);
  }
  isCatchableAt(x, y) { return this.visible && x === this.x + this.spriteXY[0] && y === this.y + this.spriteXY[1]; }
  scarePeople() { this.cast.scareMusophobes(this); }
  die() { this.cast.killMouse(this); }
  hide() { this.visible = false; }   // mice hide in place (keep x for coming back)
}

export class Frog extends Thing {
  constructor(id, services, spec, phases) {
    super(id, services, [['MoveFrog', 0.75, 0.25, 0.5]], 3);
    this.isFrog = true;
    [this.x, this.y] = [spec.x, spec.y];
    this.visible = true;
    this.animatoryState = 'SIT';
    this.sitXY = [1, 3];
    this.ericProximity = spec.ericProximity;
    this.turnRound = phases.FrogTurnRound; this.shortHop = phases.FrogShortHop; this.longHop = phases.FrogLongHop;
    this.trapped = false; this.falling = false;
    this.width = 3; this.height = 4;
  }
  sit() { this.animatoryState = 'SIT'; }
  isBlocked(distance = 0) {
    if (this.world.barrier(this, distance)) return true;
    const s = this.world.staircase(this, distance);
    return !!(s && s.force);
  }
  isCatchableAt(x, y) { return this.visible && this.animatoryState === 'SIT' && x === this.x + this.sitXY[0] && y === this.y + this.sitXY[1]; }
  insertIntoCup(cup) { this.trapped = true; this.visible = true; this.x = cup.x - this.sitXY[0]; this.y = cup.y - this.sitXY[1]; cup.frogs.push(this); }
  fallFromCup(cup) { cup.frogs = cup.frogs.filter((f) => f !== this); this.trapped = false; this.falling = true; }
  checkHeads() { return this.cast.checkHeadsAt(this.x + this.sitXY[0], this.y + this.sitXY[1] + 1); }
  bounceOffHead() { this.animatoryState = 'HOP1'; this.direction = -1; this.x -= 1; }
  isEricNearby() { const { x, y } = this.cast.eric.getLocation(); return this.y === y && Math.abs(this.x - x) < this.ericProximity; }
}

// ---- The bike ----------------------------------------------------------------
export class Bike extends Thing {
  constructor(id, services, spec) {
    super(id, services, [['MoveBike']], spec.moveDelay);
    this.unchainLocation = [spec.x, spec.y];
    this.pedalMomentum = spec.pedalMomentum; this.maxMomentum = spec.maxMomentum;
    this.momentum = 0;
    this.animatoryState = 'BIKE_ON_FLOOR';
    this.chained = true;
  }
  unchain() { [this.x, this.y] = this.unchainLocation; this.visible = true; this.chained = false; this.animatoryState = 'BIKE_ON_FLOOR'; }
  chain() { this.hide(); this.chained = true; }
  prepare() { this.momentum = 3; this.hide(); }
  pedal() { this.momentum = Math.min(this.momentum + this.pedalMomentum, this.maxMomentum); }
  startWheeling(rider) { this.x = rider.x; this.y = rider.y; this.direction = rider.direction; this.visible = true; this.animatoryState = 'BIKE_UPRIGHT'; }
  wheel() {
    this.momentum = Math.max(this.momentum - 1, 0);
    if (this.hitBarrier()) this.momentum = 0; else this.x += this.direction;
  }
  hitBarrier() { return this.world.barrier(this, this.direction < 0 ? 1 : 0); }
  fall(rider = null) {
    if (rider) { this.x = rider.x; this.y = rider.y; this.direction = rider.direction; }
    this.visible = true;
    this.animatoryState = 'BIKE_ON_FLOOR';
  }
}

// ---- Plants ------------------------------------------------------------------
export class Plant extends Thing {
  constructor(id, services, pot) {
    super(id, services, [['Grow', 12, 19, 26]], 1);
    this.pot = pot; pot.plant = this;
    this.growX = pot.x; this.y = pot.y;
    this.headHeight = 0; this.growing = false;
    this.animatoryState = 'PLANT_GROWING';
  }
  grow() { this.growing = true; }
  headCoords() { return [this.growX, this.y - this.headHeight - 1]; }
  supports(c) { const [hx, hy] = this.headCoords(); return this.headHeight > 0 && c.x === hx && c.y === hy; }
  appear() { this.x = this.growX; this.visible = true; this.animatoryState = 'PLANT_GROWING'; this.cast.liftAnyoneAt(this.growX, this.y - 1); this.headHeight = 1; }
  finishGrowing() { this.animatoryState = 'PLANT_GROWN'; this.cast.liftAnyoneAt(this.growX, this.y - 2); this.headHeight = 2; }
  isFullyGrown() { return this.headHeight === 2; }
  die() { const [hx, hy] = this.headCoords(); this.hide(); this.headHeight = 0; this.growing = false; this.cast.dropAnyoneAt(hx, hy); }
}

// ---- Stinkbomb cloud ---------------------------------------------------------
export class Stinkbomb extends Thing {
  constructor(id, services, stinkRange = 3) {
    super(id, services, [['Stink', 29]], 3);
    this.stinkRange = stinkRange;
    this.animatoryState = 'STINKBOMB';
    this.smelt = false; this.phaseIndex = 0;
  }
  drop(x, y) { this.smelt = false; this.x = x; this.y = y; this.visible = true; this.delay = 1; this.game.events.emit('stinkbomb', { x, y }); }
  moveCloud() {
    this.phaseIndex = (this.phaseIndex + 1) % 2;
    this.direction = this.phaseIndex === 0 ? -1 : 1;
    if (!this.smelt) {
      const smeller = this.cast.smeller(this);
      if (smeller) {
        const window = this.world.nearbyWindow(smeller);
        if (window && window.shut) { this.smelt = true; smeller.openWindow(window); }
      }
    }
  }
}

// ---- Desk lid ----------------------------------------------------------------
export class DeskLid extends Thing {
  constructor(id, services) {
    super(id, services, [['MoveDeskLid', 10]], 1);
    this.xOffset = 1; this.desk = null; this.opener = null;
    this.animatoryState = 'DESK_EMPTY';
  }
  raiseLid(desk, character) {
    if (this.visible) return;
    this.desk = desk; this.opener = character; this.direction = character.direction;
    this.x = desk.x + this.xOffset * this.direction; this.y = character.y;
    this.animatoryState = desk.contents === 'WATER_PISTOL' ? 'DESK_WATER_PISTOL' : (desk.contents ? 'DESK_STINKBOMBS' : 'DESK_EMPTY');
    this.visible = true; this.delay = 1;
  }
  deliverContents() { this.opener.collectDeskContents(this.desk); }
}
