// ============================================================================
// THE 3D LIBRARY (one door in)
// ----------------------------------------------------------------------------
// three.js is the only code in this project that we did not write. A copy is
// kept in vendor/three so the game still runs from plain files with no build
// step and no network. Everything in world3d/ imports it from here, so there
// is exactly one place that knows where the library lives.
// ============================================================================

export * from '../../../vendor/three/three.module.min.js';
