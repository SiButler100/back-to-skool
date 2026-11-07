// ============================================================================
// THE CAST (everyone and everything, together)
// ----------------------------------------------------------------------------
// Builds all the characters and objects from the data files, assigns each one
// its script when the lesson changes, and answers "who is near whom?" style
// questions that need the whole crowd: who's in front of Eric, which teacher
// can see him, who's standing on a knocked-out kid, and so on.
// ============================================================================

import { Character } from './character.js';
import { Eric } from './eric.js';
import { Pellet, Water, Drop, Conker, Mouse, Frog, Bike, Plant, Stinkbomb, DeskLid } from './objects.js';
import { Lesson, QAGenerator, AssemblyMessageGenerator } from './lesson.js';
import { CHARACTERS, ERIC, RANDOM_LOCATIONS } from '../data/cast.js';
import { LESSONS } from '../data/timetable.js';
import { COMMAND_LISTS } from '../data/commandLists.js';
import { MESSAGES } from '../data/messages.js';

export class Cast {
  constructor(services, input) {
    this.services = services;
    const { world, game, config, rng } = services;
    this.world = world; this.game = game; this.config = config; this.rng = rng;
    services.cast = this;

    this.characters = CHARACTERS.map((spec) => new Character({ ...spec, randomLocations: RANDOM_LOCATIONS[spec.id] }, services));
    this.eric = new Eric({ ...ERIC, randomLocations: [] }, services, input);
    this.byId = new Map(this.characters.map((c) => [c.id, c]));
    this.byId.set(this.eric.id, this.eric);
    this.characterList = [...this.characters, this.eric];   // everyone, Eric last

    // Teachers get a question generator; the swot's tales use MESSAGES.grass.
    for (const [id, spec] of Object.entries(MESSAGES.qa)) {
      const teacher = this.byId.get(id);
      if (teacher) teacher.qaGenerator = new QAGenerator(spec, rng);
    }
    this.assemblyMessages = new AssemblyMessageGenerator(rng);

    // Objects
    const phases = world.animationPhases;
    this.pellets = [];
    for (const owner of [this.get('TEARAWAY'), this.eric]) {
      const pellet = new Pellet(`${owner.id}:Pellet`, services, owner);
      owner.pellet = pellet; this.pellets.push(pellet);
    }
    this.water = new Water('Water', services, phases.Water);
    this.waterDrop = new Drop('WaterDrop', services, 'WATER');
    this.sherryDrop = new Drop('SherryDrop', services, 'SHERRY');
    this.conker = new Conker('Conker', services, world.data.conker);
    this.stinkbomb = new Stinkbomb('Stinkbomb', services, 3);
    this.deskLid = new DeskLid('DeskLid', services);
    this.bike = new Bike('Bike', services, world.data.bike);
    this.frog = new Frog('Frog', services, world.data.frog, phases);
    this.frogs = [this.frog];
    this.mouse = new Mouse('Mouse', services, [17, 3], true);
    this.mice = [this.mouse];
    this.plants = world.plantPots.map((pot) => new Plant(`Plant:${pot.id}`, services, pot));
    this.mouseLocations = world.data.mouseLocations;

    this.lesson = null;
    this.ericStopper = null;
  }

  // Everything that needs a tick each frame, in update order.
  get movables() {
    return [this.eric, ...this.characters, ...this.pellets, this.water, this.waterDrop, this.sherryDrop, this.conker,
      this.stinkbomb, this.deskLid, this.bike, ...this.frogs, ...this.mice, ...this.plants];
  }
  // Things the renderer draws (characters first so objects appear on top).
  get drawables() {
    return [...this.characters, this.eric, ...this.plants, this.bike, ...this.frogs, ...this.mice, ...this.pellets,
      this.water, this.waterDrop, this.sherryDrop, this.conker, this.stinkbomb, this.deskLid];
  }

  get(id) { return this.byId.get(id) || null; }

  // ---- Lesson changes --------------------------------------------------------
  setLesson(lessonId) {
    const details = LESSONS[lessonId];
    this.lesson = null;
    for (const c of this.characters) {
      const clId = details.cast[c.id];
      const template = COMMAND_LISTS[clId];
      if (!template) { console.warn(`No command list "${clId}" for ${c.id} in ${lessonId}`); continue; }
      c.setCommandListTemplate(template);
    }
  }
  changeCommandList(characterId, commandListId) {
    const c = this.get(characterId);
    if (c && COMMAND_LISTS[commandListId]) c.setCommandListTemplate(COMMAND_LISTS[commandListId]);
  }
  createLesson(swot, room) {
    this.lesson = new Lesson(this, swot, room, this.config, this.rng);
  }

  // ---- Reset for a new game --------------------------------------------------
  reinitialise() {
    for (const c of this.characterList) c.reinitialise();
    this.world.fillDesks(this.rng);
    this.initialiseBikeCombo();
    this.initialiseStoreroomCombo();
    for (const cup of this.world.cups.values()) { cup.contents = null; cup.frogs = []; }
    for (const d of this.world.doors.values()) d.shut = d.initiallyShut;
    for (const w of this.world.windows.values()) w.shut = w.initiallyShut;
    for (const r of this.world.rooms.values()) { r.blackboard?.clear(); r.chairs.forEach((ch) => ch.vacate()); }
    this.bike.chain(); this.bike.momentum = 0;
    this.frog.x = this.world.data.frog.x; this.frog.y = this.world.data.frog.y; this.frog.visible = true; this.frog.trapped = false; this.frog.falling = false; this.frog.sit();
    this.mice = [this.mouse]; this.mouse.visible = true; [this.mouse.x, this.mouse.y] = [17, 3];
    for (const t of [this.water, this.waterDrop, this.sherryDrop, this.conker, this.stinkbomb, this.deskLid, ...this.pellets]) t.hide();
    for (const p of this.plants) { p.hide(); p.headHeight = 0; p.growing = false; }
  }
  // Each of the four male teachers knows one digit of the bike combination...
  initialiseBikeCombo() {
    const holders = this.characters.filter((c) => c.hasBikeSecret());
    const digits = '0123456789'.split('');
    let combo = '';
    for (const c of holders) { c.bikeSecret = this.rng.choice(digits); combo += c.bikeSecret; }
    this.world.bikeCombination = combo;
  }
  // ...and one letter of the storeroom combination.
  initialiseStoreroomCombo() {
    const holders = this.characters.filter((c) => c.hasStoreroomSecret());
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let combo = '';
    for (const c of holders) { c.storeroomSecret = this.rng.choice(letters); combo += c.storeroomSecret; }
    this.world.storeroomCombination = combo;
  }

  // ---- Proximity questions ---------------------------------------------------
  facingCharacters(c, offset) {
    const tx = c.x + offset * c.direction, ty = c.y, td = -c.direction;
    return this.characterList.filter((o) => o !== c && o.x === tx && o.y === ty && o.direction === td && o.visible);
  }
  getPunchee(c, offset) { return this.facingCharacters(c, offset).find((o) => o.isPunchableNow()) || null; }
  getPelletable(x, y) {
    const ps = this.characterList.filter((c) => c.isPelletable() && c.visible);
    return ps.find((c) => c.isAdult() && c.x === x && c.y === y) || ps.find((c) => !c.isAdult() && c.x === x && c.y === y) || null;
  }
  getWaterable(x, y) { return this.characterList.find((c) => c.hasBikeSecret() && c.headAt(x, y)) || null; }
  getSherryable(x, y) { return this.characterList.find((c) => c.hasStoreroomSecret() && c.headAt(x, y)) || null; }
  getConkerable(x, y) { return this.characterList.find((c) => c.isConkerable() && c.headAt(x, y)) || null; }
  isHome(x) { return this.characterList.every((c) => c.isHome(x)); }
  isStandingOnKid(c) { return this.characterList.some((k) => k.isKnockedOut() && k.x - 1 <= c.x && c.x <= k.x + 1 && c.y === k.y - 1); }
  isBesideEric(c) { const { x, y } = this.eric.getLocation(); return Math.abs(c.x - x) <= this.config.besideEricXRange && c.y === y; }
  isTouchingEric(c) { return c.x === this.eric.x && c.y === this.eric.y; }
  nearbyCharacters(c, candidates, witness) {
    const [rx, ry] = this.config.linesGivingRange;
    return candidates.filter((o) => o !== c && Math.abs(o.x - c.x) <= rx && Math.abs(o.y - c.y) <= ry && o.hasLineOfSightTo(c)
      && (!witness || o.direction * (c.x - o.x) >= 0));
  }
  getNearbyAdults(c) { return this.nearbyCharacters(c, this.characterList.filter((o) => o.isAdult()), true); }
  getNearbyLinesGivers(c) { return this.nearbyCharacters(c, this.characterList.filter((o) => o.canGiveLines()), true).filter((o) => o.canGiveLinesNow()); }
  getNearestLinesRecipient(c) {
    const candidates = this.nearbyCharacters(c, this.characterList.filter((o) => o.canReceiveLines()), false);
    let nearest = null;
    for (const o of candidates) if (!nearest || Math.abs(o.x - c.x) < Math.abs(nearest.x - c.x)) nearest = o;
    return nearest;
  }
  hasKissees() { return this.characterList.some((c) => c.canKissEric()); }
  kissee() { return this.facingCharacters(this.eric, this.config.kissDistance).find((c) => c.canKissEric() && c.isInterruptible() && c.isStanding()) || null; }
  getEricStopper() { return this.characterList.find((c) => c.stopEric && Math.abs(c.x - this.eric.x) <= 2 && c.y === this.eric.y) || null; }

  // ---- Messages --------------------------------------------------------------
  expandTitle(message, character) { return message.replace(/\$TITLE/g, character.getTitle()); }
  expandNames(message) {
    return message.replace(/\$([A-Z0-9_]+)/g, (m, id) => {
      if (id === 'HERO') return this.eric.name;
      const c = this.get(id);
      return c ? c.name : m;
    });
  }
  getHitTale(teacher) {
    const hitterId = this.rng.choice(MESSAGES.grass.hitters);
    const name = hitterId === 'HERO' ? this.eric.name : this.get(hitterId).name;
    return [hitterId === 'HERO' ? this.eric.id : hitterId, this.expandTitle(MESSAGES.grass.hitTale.replace('$1', name), teacher)];
  }
  getWriteTale(writerId, teacher) {
    if (!MESSAGES.grass.writers.includes(writerId) && !(writerId === this.eric.id && MESSAGES.grass.writers.includes('HERO'))) return [null, null];
    const name = this.get(writerId)?.name || this.eric.name;
    return [writerId, this.expandTitle(MESSAGES.grass.writeTale.replace('$1', name), teacher)];
  }
  getAbsentTale(teacher) { return this.expandTitle(this.expandNames(MESSAGES.grass.absentTale), teacher); }

  // ---- Objects ---------------------------------------------------------------
  openDesk(character, desk) { this.deskLid.raiseLid(desk, character); }
  knockCup(cup) {
    if (cup.frogs.length) { for (const f of cup.frogs.slice()) f.fallFromCup(cup); return; }
    if (cup.contents === 'WATER' && !this.waterDrop.visible) this.waterDrop.fall(cup.x, cup.y);
    else if (cup.contents === 'SHERRY' && !this.sherryDrop.visible) this.sherryDrop.fall(cup.x, cup.y);
    this.world.fillCup(cup.id, null);
    this.game.events.emit('cup', { cup, contents: null });
  }
  insertFrog(cup) { for (const f of this.frogs) if (!f.visible) { f.insertIntoCup(cup); break; } }
  checkHeadsAt(x, y) {
    for (const c of this.characterList) if (c.hasSafeKey() && c.headAt(x, y)) { this.eric.takeSafeKey(); return true; }
    return false;
  }
  hitConker(pellet) {
    if (this.conker.hitBy(pellet)) { this.conker.fall(pellet.hitCoords()[0], this.conker.box.maxY); return true; }
    return false;
  }
  conkerFalling() { return this.conker.visible; }
  getAnimal(x, y) { return [...this.mice, ...this.frogs].find((a) => a.isCatchableAt(x, y)) || null; }
  caughtMouse(mouse) { if (mouse.immortal) this.relocateMouse(mouse); else this.killMouse(mouse); }
  relocateMouse(mouse) {
    const locations = this.rng.shuffle(this.mouseLocations);
    for (const [x, y] of locations) { mouse.x = x; mouse.y = y; if (!this.game.isOnScreen(mouse)) break; }
    mouse.visible = true;
    mouse.commandList.setTemplate([['MoveMouse', [5, 20], [2, 5], [2, 5], [10, 41]]]);
  }
  releaseMice(n, x, y) {
    for (let i = 0; i < n; i++) {
      const m = new Mouse(`MortalMouse${Date.now()}${i}`, this.services, [x, y], false);
      m.direction = this.rng.choice([-1, 1]);
      this.mice.push(m);
    }
  }
  killMouse(mouse) { this.mice = this.mice.filter((m) => m !== mouse); }
  scareMusophobes(mouse) { for (const c of this.characterList) c.checkMouse(mouse); }
  smeller(bomb) { return this.characterList.find((c) => c.canSmellStinkbomb(bomb)) || null; }
  isBikeVisible() { return this.bike.visible; }
  isBesideBike(c) { return this.bike.visible && this.bike.animatoryState === 'BIKE_ON_FLOOR' && Math.abs(c.x - this.bike.x) <= 1 && c.y === this.bike.y; }
  moveBikeAway(doorId) {
    const door = this.world.getDoor(doorId);
    if (door && this.bike.visible && Math.abs(this.bike.x - door.x) <= 2 && this.bike.y === door.bottomY - 3) this.bike.x = door.x - 3;
  }
  unchainBike() { this.bike.unchain(); }
  waterPlant(pot, liquid) { if (liquid === 'WATER' && pot.plant) pot.plant.grow(); }
  liftAnyoneAt(x, y) { for (const c of this.characterList) if (c.x === x && c.y === y) c.y -= 1; }
  dropAnyoneAt(x, y) { for (const c of this.characterList) if (c.x === x && c.y === y) c.fallOffPlant(); }
  plant(c) { return this.plants.find((p) => p.supports(c)) || null; }

  // ---- Per-tick update -------------------------------------------------------
  move() { for (const m of this.movables) m.move(); }
}
