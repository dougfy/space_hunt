/**
 * Bot System Test Script
 * 
 * Usage: Open the game in browser, open DevTools console, paste this entire script.
 * It will spawn bots, trigger ticks, and validate state transitions.
 */

(async function testBots() {
  const log = (msg) => console.log(`%c[BOT-TEST] ${msg}`, 'color: #0f0; font-weight: bold');
  const err = (msg) => console.error(`[BOT-TEST] ❌ ${msg}`);
  const ok = (msg) => log(`✅ ${msg}`);

  async function api(path, body) {
    const res = await fetch(`/api/bots${path}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // --- Step 1: Reset any existing bots ---
  log('Step 1: Resetting bot system...');
  await api('/reset', {});
  const afterReset = await api('/list');
  if (afterReset.bots.length === 0) ok('Reset successful - no bots');
  else err(`Reset failed, still ${afterReset.bots.length} bots`);

  // --- Step 2: Spawn alliance-manager ---
  log('Step 2: Spawning Zephyr-7 (alliance-manager)...');
  const spawnMgr = await api('/spawn', { name: 'Zephyr-7', role: 'alliance-manager', targets: ['WeirdAd4511'] });
  if (spawnMgr.ok) ok('Zephyr-7 spawned');
  else err(`Spawn failed: ${JSON.stringify(spawnMgr)}`);

  // --- Step 3: Spawn alliance-member ---
  log('Step 3: Spawning Nova-3 (alliance-member)...');
  const spawnMem = await api('/spawn', { name: 'Nova-3', role: 'alliance-member', targets: [] });
  if (spawnMem.ok) ok('Nova-3 spawned');
  else err(`Spawn failed: ${JSON.stringify(spawnMem)}`);

  // --- Step 4: Verify list ---
  log('Step 4: Verifying bot list...');
  const list = await api('/list');
  if (list.bots.length === 2) ok(`2 bots registered: ${list.bots.map(b => b.config.name).join(', ')}`);
  else err(`Expected 2 bots, got ${list.bots.length}`);

  // --- Step 5: Run ticks and observe FSM progression ---
  log('Step 5: Running tick sequence (will tick 5 times with 11s gaps)...');
  log('         Manager should: init → create alliance → idle → invite');
  log('         Member should:  init → waiting → (accept invite after manager invites)');

  for (let i = 1; i <= 5; i++) {
    // Force tick by clearing the rate-limit (we can't do that externally, so just call tick repeatedly)
    const tickResult = await api('/tick', {});
    const listNow = await api('/list');

    const mgr = listNow.bots.find(b => b.config.name === 'Zephyr-7');
    const mem = listNow.bots.find(b => b.config.name === 'Nova-3');

    log(`  Tick ${i}: Manager FSM=${mgr?.state?.fsm || '?'}, alliance=${mgr?.state?.allianceName || 'none'}, invited=${mgr?.state?.invitedPlayers?.length || 0}`);
    log(`  Tick ${i}: Member  FSM=${mem?.state?.fsm || '?'}, alliance=${mem?.state?.allianceName || 'none'}`);

    if (i < 5) {
      log(`  Waiting 11s for rate-limit to expire...`);
      await sleep(11000);
    }
  }

  // --- Step 6: Final validation ---
  log('Step 6: Final validation...');
  const final = await api('/list');
  const mgrFinal = final.bots.find(b => b.config.name === 'Zephyr-7');
  const memFinal = final.bots.find(b => b.config.name === 'Nova-3');

  if (mgrFinal?.state?.allianceId) ok(`Manager has alliance: "${mgrFinal.state.allianceName}" (${mgrFinal.state.allianceId})`);
  else err('Manager never created alliance');

  if (mgrFinal?.state?.invitedPlayers?.length > 0) ok(`Manager invited: ${mgrFinal.state.invitedPlayers.join(', ')}`);
  else err('Manager never invited anyone');

  if (mgrFinal?.state?.fsm === 'idle') ok('Manager in idle state (correct)');
  
  if (memFinal?.state?.fsm === 'idle' && memFinal?.state?.allianceId) {
    ok(`Member joined alliance: "${memFinal.state.allianceName}"`);
  } else {
    log(`⚠️  Member not yet in alliance (FSM=${memFinal?.state?.fsm}). May need more ticks or to be invited.`);
    log(`   Note: Member only joins if invited by manager. Manager targets=['WeirdAd4511'] not Nova-3.`);
    log(`   To test member joining, spawn manager with targets including Nova-3.`);
  }

  log('--- Test complete! ---');
  log('To also test member joining, run:');
  log('  await fetch("/api/bots/reset", {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})');
  log('  await fetch("/api/bots/spawn", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Zephyr-7",role:"alliance-manager",targets:["Nova-3"]})})');
  log('  await fetch("/api/bots/spawn", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Nova-3",role:"alliance-member",targets:[]})})');
  log('  Then wait ~60s for ticks to process.');
})();
