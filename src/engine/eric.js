// ============================================================================
// ERIC (you)
// ----------------------------------------------------------------------------
// Eric is a Character whose brain is the keyboard rather than a command list.
// Each tick he reads the input, works out whether any nearby teacher should be
// giving him lines, and either walks or hands control to a short "controller"
// command (jumping, firing, writing) until that finishes.
// ============================================================================

import { Character } from './character.js';
import * as cmd from './commands.js';
import { MESSAGES } from '../data/messages.js';

export const ITEMS = {
  SAFE_KEY: 'SAFE_KEY', STOREROOM_KEY: 'STOREROOM_KEY', FROG: 'FROG',
  WATER_PISTOL: 'WATER_PISTOL', SHERRY_PISTOL: 'SHERRY_PISTOL',
  STINKBOMBS3: 'STINKBOMBS3', STINKBOMBS2: 'STINKBOMBS2', STINKBOMBS1: 'STINKBOMBS1',
};

export class Eric extends Character {
  constructor(spec, services, input) {
    super(spec, services);
    this.input = input;
    this.bendOverHandXY = spec.bendOverHandXY || [0, 3];
    this.defaultWalkDelay = this.config.ericWalkDelay;
    this.reset();
  }

  reset() {
    this.inventory = new Set();
    this.mice = 0;
    this.controller = null;
    this.writing = false;
    this.frozen = false; this.understood = false; this.paralysed = false; this.expelled = false;
    this.linesDelay = 0; this.lastLinesGiver = null;
    this.baseLocation = null; this.hideCoords = null;
    this.bike = null; this.sittingOnSaddle = false; this.bikeKey = null; this.lastBikeKey = null;
    this.walkDelay = this.defaultWalkDelay;
    this.floorTimer = 0;     // moves left before Eric gets up from the floor by himself
  }

  reinitialise() { super.reinitialise(); this.reset(); }
  isEric() { return true; }
  canSitOnStairs() { return this.canGiveLinesMessageAny('NO_SITTING_ON_STAIRS'); }
  canGiveLinesMessageAny(id) { return !!MESSAGES.lines[id]; }

  setController(command) {
    if (command) command.character = this;
    this.controller = command;
  }

  // ---- The per-tick update ---------------------------------------------------
  move() {
    this.getLines();
    this.walkDelay -= 1;
    if (this.walkDelay > 0) return;
    this.walkDelay = this.defaultWalkDelay;
    this.barrier = this.world.barrier(this) || this.cast.getEricStopper();
    this.floor = this.getFloor();
    this.room = this.world.room(this);
    const input = this.input;

    if (this.controller) {
      const next = this.controller.execute();
      if (next === this.controller) this.setController(null);
      else if (next) this.setController(next);
      input.flush();
      return;
    }
    if (this.paralysed) { input.flush(); return; }
    if (this.midstride()) { this.walk(); input.flush(); return; }

    // On the floor (knocked out, or pushed off a chair): get up automatically
    // after a moment, or straight away if 'up' is pressed.
    if (this.isKnockedOut() || (this.isSittingOnFloor() && this.floorTimer > 0)) {
      this.floorTimer -= 1;
      if (this.floorTimer <= 0 || input.wasPressed('up')) { this.floorTimer = 0; this.standUpFromFloor(); }
      input.flush();
      return;
    }
    if (this.isSitting()) {
      if (input.wasPressed('up')) this.standUpFromFloor();
      else if (this.isSittingOnChair() && input.wasPressed('down')) this.openDesk(this.world.desk(this));
      input.flush();
      return;
    }
    this.staircase = this.world.staircase(this);
    // 'down' sits when there are no stairs to go down; on stairs it descends.
    if (input.wasPressed('down') && !this.staircase && this.floor && this.sit()) { this.game.playSound('SIT'); input.flush(); return; }
    if (input.wasPressed('jump')) { this.setController(new cmd.Jump()); input.flush(); return; }
    if (input.wasPressed('fire')) { const c = this.fireAction(); if (c) { this.setController(c); input.flush(); return; } }
    if (input.wasPressed('act')) { const c = this.actAction(); if (c) { this.setController(c); input.flush(); return; } }
    if (input.wasPressed('drop')) { const c = this.dropAction(); if (c) { this.setController(c); input.flush(); return; } }

    if (!this.isSupported()) { this.y += 1; input.flush(); return; }
    this.baseLocation = null;
    const plant = this.cast.plant(this);
    if (input.pressed('left')) {
      if (plant && plant.isFullyGrown()) {
        const barrier = this.world.barrier(this, 1);
        if (barrier && barrier.isShut() && barrier.climbPhases) { this.setController(new cmd.Flight(this.world.animationPhases[barrier.climbPhases])); input.flush(); return; }
      }
      this.left();
    } else if (input.pressed('right')) {
      if (plant && plant.isFullyGrown()) {
        const window = this.world.window(this);
        if (window) {
          if (!window.isShut()) this.setController(new cmd.Flight(this.world.animationPhases[window.climbPhases], window.notABird));
          input.flush(); return;
        }
        if (this.barrier && this.barrier.isShut() && this.barrier.climbPhases) { this.setController(new cmd.Flight(this.world.animationPhases[this.barrier.climbPhases])); input.flush(); return; }
      }
      this.right();
    } else if (input.pressed('up') && this.staircase) {
      this.up();
    } else if (input.pressed('down') && this.staircase) {
      this.down();
    }
    input.flush();
  }

  standUpFromFloor() {
    if (this.isSittingOnChair()) this.chair().vacate();
    this.animatoryState = 'WALK0';
    this.game.playSound('SIT');
  }

  // The Fire key: the water pistol when Eric is carrying one AND a cup or
  // plant pot is where the jet would land; otherwise the catapult.
  fireAction() {
    if (this.hasWaterPistol() && this.canFireWaterPistol() && this.waterTargetAhead()) return new cmd.FireWaterPistol();
    if (this.canFireCatapult()) return new cmd.FireCatapult();
    return null;
  }
  // Trace the water jet's flight path and see whether it meets a cup or a pot.
  waterTargetAhead() {
    const phases = this.world.animationPhases.Water;
    const d = this.direction;
    let x = this.x + 2 * d, y = this.y - 2;
    for (let i = 0; i < 12; i++) {
      const [, xInc, yInc, hit] = phases[Math.min(i, phases.length - 1)];
      if (hit === 1 && this.world.cup(x - (d < 0 ? 1 : -3), y)) return true;
      if (hit === 2 && this.world.plantPot(x, y)) return true;
      if (this.world.floorAt(x, y)) return false;
      x += d * xInc; y += yInc;
    }
    return false;
  }

  // The Act key: whatever makes sense right in front of Eric, in priority order.
  actAction() {
    if (this.world.besideBlackboard(this)) {
      this.raiseArm(); this.input.startWriting(); this.writing = true;
      return new cmd.Write();
    }
    if (this.canBendOver()) {
      const [hx, hy] = this.bendOverHandCoords();
      if (this.cast.getAnimal(hx, hy)) { this.bendOver(); return new cmd.Catch(); }
    }
    if (this.canMountBike()) { this.bike = this.cast.bike; this.mountBike(); return new cmd.RideBike(this.bike); }
    if (this.canKiss() && this.kissee()) { this.previousAs = this.animatoryState; return new cmd.Kiss(); }
    return new cmd.Hit();   // a punch, at whoever is in reach or at thin air, as the original allowed
  }

  // The Drop key: a stinkbomb while Eric has any; otherwise let the mice go.
  dropAction() {
    if (this.canDropStinkbomb()) return new cmd.DropStinkbomb();
    if (this.canReleaseMice()) { this.bendOver(); return new cmd.ReleaseMice(); }
    return null;
  }

  // Eric's left/right never return commands; a shut door just stops him.
  left() { const r = super.left(); if (r instanceof cmd.OpenDoor) this.openDoorNow(); }
  right() { const r = super.right(); if (r instanceof cmd.OpenDoor) this.openDoorNow(); }
  openDoorNow() { this.world.moveDoor(this.barrier.id, false); this.game.events.emit('door', { id: this.barrier.id, shut: false }); }
  canOpenDoor(door) {
    if (door.id === 'ScienceLabDoor' && this.inventory.has(ITEMS.STOREROOM_KEY)) return true;
    return super.canOpenDoor(door);
  }

  isSupported() {
    return !!(this.staircase || this.cast.isStandingOnKid(this) || this.world.onFloor(this)
      || this.world.plantPot(this.x, this.y) || this.cast.plant(this));
  }

  // ---- Lines -----------------------------------------------------------------
  getLines() {
    this.linesDelay = Math.max(0, this.linesDelay - 1);
    if (this.linesDelay > this.config.minimumLinesDelay / 2) return;
    if (this.linesDelay === 0) this.lastLinesGiver = null;
    const room = this.world.room(this);
    const homeRoom = this.world.homeRoom;
    let x, y;
    if (this.baseLocation) [x, y] = this.baseLocation;
    else if (this.bike && !this.sittingOnSaddle) { x = this.x; y = this.bike.y; }
    else { x = this.x; y = this.y; }

    if (this.world.inNoGoZone(x, y)) this.alertLinesGivers('GET_OUT', true);
    else if (this.shouldGetAlong()) this.alertLinesGivers('GET_ALONG', true);
    else if (this.isSittingOnStairs()) this.alertLinesGivers('NO_SITTING_ON_STAIRS', true);
    else if (this.isKnockedOut()) this.alertLinesGivers('GET_UP', true);
    else if (this.bike && !this.world.inPlayground(this)) this.alertLinesGivers('NO_BIKES', true);
    else if (this.world.plantPot(this.x, this.y) || this.cast.plant(this)) this.alertLinesGivers('GET_OFF_PLANT', true);
    else {
      const isAssembly = this.game.isAssembly();
      if (this.isSittingOnFloor()) {
        if (room && room.id === 'AssemblyHall') {
          if (this.direction !== this.config.assemblySitDirection) this.alertLinesGivers(isAssembly ? 'SIT_FACING_STAGE' : 'GET_UP', true);
        } else {
          this.alertLinesGivers('GET_UP', true);
        }
      } else if (this.isStanding() && homeRoom && homeRoom.contains(this) && (homeRoom.chairs.length || homeRoom.id === 'AssemblyHall')) {
        this.alertLinesGivers('SIT_DOWN', true);
      }
    }
  }
  isAbsent() { const home = this.world.homeRoom; return home !== null && home !== this.world.room(this); }
  shouldGetAlong() { return this.game.shouldGetAlong(this); }
  alertLinesGivers(messageId, resetDelay = false) {
    if (!MESSAGES.lines[messageId]) return;
    let givers = this.cast.getNearbyLinesGivers(this);
    if (resetDelay && this.lastLinesGiver) givers = givers.filter((g) => g !== this.lastLinesGiver);
    if (!givers.length) return;
    let giver = givers[0];
    if (messageId === 'GET_ALONG') {
      const teacher = this.game.getTeacher();
      if (teacher && givers.includes(teacher)) { giver = teacher; messageId = teacher.getComeAlongMessageId(); }
      else if (this.world.inPlayground(this)) messageId = 'BACK_TO_SKOOL';
    }
    if (resetDelay) this.linesDelay = this.config.minimumLinesDelay;
    giver.giveLines(this.id, messageId);
    this.lastLinesGiver = giver;
  }

  // ---- Being hit -------------------------------------------------------------
  dethrone() { this.sitOnFloor(); this.floorTimer = this.config.ericFloorMoves; this.game.playSound('KNOCKED_OUT'); }
  isDeckable() {
    const deckable = super.isDeckable();
    if (this.writing) return deckable;
    if (this.controller) return false;
    return deckable;
  }
  deck() {
    if (this.isSittingOnChair()) this.chair().vacate();
    this.knockOver();
    this.floorTimer = this.config.ericFloorMoves;
    if (this.writing) { this.writing = false; this.input.finishWriting(); this.setController(null); }
    this.game.playSound('KNOCKED_OUT');
    this.game.events.emit('decked', { character: this });
  }

  // ---- Catapult, water pistol, stinkbombs -----------------------------------
  canFireCatapult() { return super.canFireCatapult() && !this.cast.conkerFalling(); }
  aimCatapult() { super.aimCatapult(); this.alertLinesGivers('NO_CATAPULTS'); this.game.playSound('CATAPULT'); }
  hasWaterPistol() { return this.inventory.has(ITEMS.WATER_PISTOL) || this.inventory.has(ITEMS.SHERRY_PISTOL); }
  canFireWaterPistol() { return this.hasWaterPistol() && super.canFireWaterPistol(); }
  canDumpWaterPistol() { return this.hasWaterPistol() && this.canBendOver(); }
  dumpWaterPistol() {
    const pistol = this.inventory.has(ITEMS.WATER_PISTOL) ? ITEMS.WATER_PISTOL : (this.inventory.has(ITEMS.SHERRY_PISTOL) ? ITEMS.SHERRY_PISTOL : null);
    if (pistol) { this.inventory.delete(pistol); this.inventoryChanged(); this.world.hideInDesk(ITEMS.WATER_PISTOL, this.rng); }
    this.walkDelay = this.config.bendOverDelay;
  }
  fireWaterPistol() {
    const liquid = this.inventory.has(ITEMS.SHERRY_PISTOL) ? 'SHERRY' : 'WATER';
    super.fireWaterPistol(liquid);
    this.alertLinesGivers('NO_WATERPISTOLS');
    this.game.playSound('WATER_PISTOL');
  }
  canDropStinkbomb() { return !!this.floor && this.hasStinkbomb() && super.canDropStinkbomb(); }
  hasStinkbomb() { return [ITEMS.STINKBOMBS1, ITEMS.STINKBOMBS2, ITEMS.STINKBOMBS3].some((i) => this.inventory.has(i)); }
  dropStinkbomb() {
    super.dropStinkbomb();
    if (this.inventory.has(ITEMS.STINKBOMBS3)) { this.inventory.delete(ITEMS.STINKBOMBS3); this.inventory.add(ITEMS.STINKBOMBS2); }
    else if (this.inventory.has(ITEMS.STINKBOMBS2)) { this.inventory.delete(ITEMS.STINKBOMBS2); this.inventory.add(ITEMS.STINKBOMBS1); }
    else if (this.inventory.has(ITEMS.STINKBOMBS1)) this.inventory.delete(ITEMS.STINKBOMBS1);
    this.inventoryChanged();
    this.alertLinesGivers('NO_STINKBOMBS');
  }

  // ---- Desks -----------------------------------------------------------------
  openDesk(desk) { if (desk) this.cast.openDesk(this, desk); }
  collectDeskContents(desk) {
    if (desk.contents) {
      if (desk.contents === ITEMS.STINKBOMBS3) { this.inventory.delete(ITEMS.STINKBOMBS2); this.inventory.delete(ITEMS.STINKBOMBS1); }
      this.inventory.add(desk.contents);
      if (desk.contents === ITEMS.WATER_PISTOL) desk.empty();
      this.game.playSound('DESK');
      this.game.events.emit('found', { item: desk.contents });
      this.inventoryChanged();
    }
  }
  inventoryChanged() { this.game.events.emit('inventory', { items: [...this.inventory], mice: this.mice }); }

  // ---- Punch, jump, bend, catch ---------------------------------------------
  punch() { super.punch(); this.alertLinesGivers('NO_HITTING'); this.game.playSound('HIT'); }
  jump() {
    if (!this.baseLocation) this.baseLocation = [this.x, this.y];
    this.previousAs = this.animatoryState;
    this.y -= 1;
    this.walkDelay = this.config.jumpDelay;
    this.animatoryState = 'ARM_UP';
    this.alertLinesGivers('NO_JUMPING');
  }
  descend() {
    this.game.playSound('JUMP');
    const [x, y] = this.locationAboveHand();
    if (this.world.isSafeAt(x, y) && this.inventory.has(ITEMS.SAFE_KEY)) this.game.upAYear();
    if (this.world.isOpenDrinksCabinetAt(x, y) && this.inventory.has(ITEMS.WATER_PISTOL)) {
      this.inventory.delete(ITEMS.WATER_PISTOL); this.inventory.add(ITEMS.SHERRY_PISTOL);
      this.inventoryChanged(); this.game.playSound('SHERRY');
      this.game.events.emit('found', { item: ITEMS.SHERRY_PISTOL });
    }
    if (!this.cast.isStandingOnKid(this) && !this.world.plantPot(this.x, this.y)) { this.y += 1; this.baseLocation = null; }
    this.animatoryState = this.previousAs;
  }
  locationAboveHand() { return [this.x + this.direction + 1, this.y]; }
  canBendOver() { return this.states.has('BENDING_OVER'); }
  bendOver() { this.previousAs = this.animatoryState; this.walkDelay = 1; this.animatoryState = 'BENDING_OVER'; }
  bendOverHandCoords() {
    const hx = this.x + (this.direction < 0 ? this.bendOverHandXY[0] : this.width - this.bendOverHandXY[0] - 1);
    return [hx, this.y + this.bendOverHandXY[1]];
  }
  catchAnimal() {
    const [hx, hy] = this.bendOverHandCoords();
    const animal = this.cast.getAnimal(hx, hy);
    if (animal) {
      if (animal.isMouse) {
        this.game.addToScore(this.config.mouseCatchScore);
        this.game.playSound('MOUSE');
        this.mice += 1;
        this.cast.caughtMouse(animal);
        this.game.events.emit('found', { item: 'MOUSE' });
      } else if (animal.isFrog) {
        animal.hide();
        this.game.playSound('FROG');
        this.inventory.add(ITEMS.FROG);
        this.game.events.emit('found', { item: ITEMS.FROG });
      }
      this.inventoryChanged();
    }
    this.walkDelay = this.config.bendOverDelay;
  }
  canReleaseMice() { return !!this.floor && this.mice > 0 && this.canBendOver(); }
  releaseMice() {
    const [hx, hy] = this.bendOverHandCoords();
    if (this.mice > 0) {
      const n = Math.min(this.mice, this.config.maxMiceRelease);
      this.mice -= n;
      this.inventoryChanged();
      this.cast.releaseMice(n, hx, hy);
    }
    this.walkDelay = this.config.bendOverDelay;
  }
  standUp() { this.animatoryState = this.previousAs; this.walkDelay = 1; }
  getLocation() {
    const saved = [this.x, this.y];
    if (this.hideCoords) [this.x, this.y] = this.hideCoords;
    else if (this.baseLocation) [this.x, this.y] = this.baseLocation;
    const loc = super.getLocation();
    [this.x, this.y] = saved;
    return loc;
  }

  // ---- Writing on blackboards ------------------------------------------------
  write() {
    const room = this.world.room(this);
    const blackboard = room ? room.blackboard : null;
    if (this.hasArmRaised()) {
      this.lowerArm();
      this.writing = this.input.writing;
      if (this.writing) this.alertLinesGivers('NO_WRITING');
      else if (blackboard) this.checkCombinations(blackboard);
      return !this.writing;
    }
    const ch = this.input.nextTyped();
    if (ch !== undefined) {
      if (ch === '\n') { this.raiseArm(); this.input.finishWriting(); return; }
      if (blackboard && this.game.fontHas(ch)) {
        this.raiseArm();
        blackboard.write(ch, this.game.measureText);
        blackboard.writer = this;
      }
    } else {
      this.walkDelay = 1;
    }
  }
  checkCombinations(blackboard) {
    if (!this.cast.isBikeVisible() && this.world.gotBikeCombination(blackboard)) {
      this.game.addToScore(this.config.bikeCombinationScore);
      this.cast.unchainBike();
      this.game.playSound('BIKE');
      this.game.events.emit('quest', { step: 'bikeUnchained' });
    } else if (!this.inventory.has(ITEMS.STOREROOM_KEY) && this.world.gotStoreroomCombination(blackboard)) {
      this.game.addToScore(this.config.storeroomCombinationScore);
      this.inventory.add(ITEMS.STOREROOM_KEY);
      this.inventoryChanged();
      this.game.playSound('STOREROOM_KEY');
      this.game.events.emit('quest', { step: 'storeroomKey' });
    }
  }

  // ---- Being frozen / expelled ----------------------------------------------
  freeze() {
    if (this.frozen || this.controller) return false;
    this.setController(new cmd.Freeze());
    this.frozen = true;
    return true;
  }
  unfreeze() { if (this.frozen) { this.setController(null); this.frozen = false; this.understood = false; } }
  checkUnderstanding() { if (this.input.wasPressed('act') || this.input.wasPressed('jump')) this.understood = true; }
  paralyse(commandListId) { this.expelled = true; this.paralysed = true; this.game.expelEric(commandListId); }
  takeSafeKey() {
    if (!this.inventory.has(ITEMS.SAFE_KEY)) {
      this.game.addToScore(this.config.safeKeyScore);
      this.game.playSound('SAFE_KEY');
      this.inventory.add(ITEMS.SAFE_KEY);
      this.inventoryChanged();
      this.game.events.emit('quest', { step: 'safeKey' });
    }
  }

  // ---- Kissing ---------------------------------------------------------------
  canKiss() { return this.cast.hasKissees(); }
  kissee() { return this.cast.kissee(); }
  kiss() { this.game.addLines(-this.config.kissLines); this.game.playSound('KISS'); this.game.events.emit('kiss', {}); }
  hide() { this.hideCoords = [this.x, this.y]; super.hide(); }
  unhide() { if (this.hideCoords) { [this.x, this.y] = this.hideCoords; this.hideCoords = null; } this.visible = true; }

  // ---- Falling and flying ----------------------------------------------------
  fallToFloor() { this.sitOnFloor(); this.floorTimer = this.config.ericFloorMoves; this.game.playSound('KNOCKED_OUT'); }
  fallOffPlant() { this.setController(new cmd.FallToFloor()); }
  fly(xInc, yInc) {
    if (!this.baseLocation) this.baseLocation = [this.x, this.y];
    this.x += xInc * this.direction;
    this.y += yInc;
  }
  endFlight() { this.baseLocation = null; this.walkDelay = 1; }

  // ---- The bike --------------------------------------------------------------
  canMountBike() { return this.states.has('RIDING_BIKE0') && this.cast.isBesideBike(this); }
  mountBike() {
    this.lastBikeKey = null; this.sittingOnSaddle = true; this.startedPedalling = false;
    this.previousAs = this.animatoryState; this.animatoryState = 'RIDING_BIKE0';
  }
  checkBikeKeys() {
    this.bikeKey = null;
    for (const key of ['left', 'right', 'up', 'down', 'jump']) {
      if (this.input.wasPressed(key)) { this.bikeKey = key; break; }
    }
  }
  hitBarrier(bike) {
    if (bike.visible) return bike.hitBarrier() || this.cast.getEricStopper();
    const distance = this.direction < 0 ? 1 : 0;
    return this.world.barrier(this, distance) || this.cast.getEricStopper();
  }
  // Alternate left/right to pedal. Once rolling, the bike carries on in the
  // direction Eric was facing when he mounted, until the momentum runs out.
  pedalled() {
    if (!this.sittingOnSaddle) return false;
    const pedalled = (this.bikeKey === 'left' || this.bikeKey === 'right') && this.bikeKey !== this.lastBikeKey;
    if (pedalled) { this.startedPedalling = true; this.pedal(); this.lastBikeKey = this.bikeKey; }
    if (this.startedPedalling) this.x += this.direction;
    return pedalled;
  }
  pedal() { this.animatoryState = this.animatoryState === 'RIDING_BIKE0' ? 'RIDING_BIKE1' : 'RIDING_BIKE0'; }
  dismounted() { return this.sittingOnSaddle && this.bikeKey === 'down'; }
  dismount() { this.bike = null; }
  stoodOnSaddle() {
    if (this.sittingOnSaddle && this.bikeKey === 'up') { this.lastBikeKey = this.bikeKey; this.sittingOnSaddle = false; }
    return !this.sittingOnSaddle;
  }
  standOnSaddle() { this.animatoryState = 'WALK0'; this.x -= this.direction; this.y -= 1; }
  gotBackOnSaddle() {
    if (!this.sittingOnSaddle && this.bikeKey === 'down') { this.lastBikeKey = this.bikeKey; this.sittingOnSaddle = true; }
    return this.sittingOnSaddle;
  }
  getBackOnSaddle() { this.animatoryState = 'RIDING_BIKE0'; this.x += this.direction; this.y += 1; }
  jumpedOffSaddle() {
    if (!this.sittingOnSaddle && (this.bikeKey === 'jump' || this.bikeKey === 'up')) {
      this.baseLocation = [this.x, this.cast.bike.y];
      return true;
    }
    return false;
  }
  checkCup() {
    if (this.inventory.has(ITEMS.FROG)) {
      const [x, y] = this.locationAboveHand();
      const cup = this.world.cup(x, y);
      if (cup) {
        this.cast.insertFrog(cup);
        this.inventory.delete(ITEMS.FROG);
        this.inventoryChanged();
        this.game.playSound('FROG');
        this.game.events.emit('quest', { step: 'frogInCup' });
      }
    }
  }
  landed() {
    if (this.baseLocation && this.y >= this.baseLocation[1] && this.getFloor()) { this.baseLocation = null; return true; }
    return false;
  }
}
