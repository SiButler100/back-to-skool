// ============================================================================
// RANDOM NUMBERS
// ----------------------------------------------------------------------------
// A small seedable random number generator. Seeding means a given seed always
// produces the same sequence, which makes bugs reproducible: if something odd
// happens on seed 1234, it will happen again on seed 1234.
// ============================================================================

export class RNG {
  constructor(seed = Date.now() % 2147483647) {
    this.seed = seed || 1;
    this.state = this.seed;
  }

  // A float in [0, 1). (Park-Miller "minimal standard" generator.)
  random() {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  // An integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  // One element of an array.
  choice(array) {
    return array[Math.floor(this.random() * array.length)];
  }

  // Shuffle a copy of an array.
  shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
