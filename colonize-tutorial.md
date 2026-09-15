# Colonize Tutorial — Sequence and Requirements

This document captures the intended colonization tutorial flow for Valcordia Space. It is meant to be a clear, implementation-oriented reference for the tutorial logic, UI gating, and player expectations.

## Goal

The player should not be able to jump directly into colony settlement without first understanding the scouting and transit steps. The tutorial teaches colonization as a multi-step journey rather than a single button press.

## Required Sequence

The actual intended order is:

1. Build a Basic Probe
2. Wait for the probe to complete
3. Send the probe to a valid target star
4. Build the Colony Ship
5. Do not start the colony action before the probe has been sent
6. Once the colony ship is ready, open FLEET and send the Colony Ship to a highlighted discovered/unowned star
7. The player must also travel personally to the destination system/star
8. Once there, visit the star and locate the planetary marker
9. Orbit the marked planet
10. Press COLONIZE

## Core Rules

### 1) Probe-first rule

A player must build and send a probe before the colony tutorial can move to the final colony-send flow.

This is not optional or decorative. It teaches discovery and gives the player a valid target for settlement.

### 2) One build at a time

The game should only allow a single ship construction action at a time. The tutorial should respect that rule and not assume the player can queue two ships simultaneously.

If the Colony Ship is still building, the tutorial should not suggest a colony launch yet. The player should continue using the probe path while the colony build completes.

### 3) Send probe while colony is building

The correct progression is:

- build probe
- send probe while the colony ship is still under construction
- wait for the probe to reveal / arrive
- then complete the colony ship and send it

This avoids a broken tutorial path where the player is pushed into colony launch without having completed the scouting step.

### 4) Colony ship requires a discovered star

The colony ship should only be sent to an eligible target:

- unowned star
- star can be probed or visited
- highlighted by the game as a valid destination

Other stars should be unavailable or visually explained as invalid.

### 5) Player travel is required

The colony ship arriving at a star is not enough. The player must personally travel to that destination to complete the settlement flow.

This is a critical tutorial point: the colony ship can be in transit, but the player needs to go there and confirm the arrival path before colonization can happen.

### 6) Final colonize step happens at the destination

After arrival, the player should:

- reach the destination star
- visit it
- locate the colony marker / indicated planet
- orbit that planet
- press COLONIZE

Only then should the star be claimed and the colony finalized.

## Tutorial Stages

### Stage A — Build Probe

Callout explains:

- probes reveal stars
- probes are required before colony targeting
- ship building starts at the Space Dock

Expected action:

- open SHIPS tab
- build Basic Probe

![Open Ships — pointer to the SHIPS tab](docs/images/Ships%201.png)

![Build a Probe — pointer to the Basic Probe build button](docs/images/BuildProbe.png)

![Probe under construction — build progress indicator](docs/images/Building%20Probe.png)

### Stage B — Send Probe

After the probe exists, the tutorial should move into the FLEET flow and require the player to send the probe.

Expected action:

- open FLEET
- select the probe
- send it to a valid highlighted star

![Send Probe — reminder to send before building or sending the Colony Ship](docs/images/Send%20Probe.png)

This step is mandatory before the colony ship launch is allowed.

### Stage C — Colony Ship Build

Once the probe has been sent, the tutorial can allow the Colony Ship build flow.

Expected action:

- open SHIPS tab again
- build Colony Ship
- only one ship build at a time should be in progress

![Build a Colony Ship — pointer to the Colony Ship build button](docs/images/Build%20Colony.png)

### Stage D — Send Colony Ship

After the Colony Ship is built and the target is valid:

- open FLEET
- send Colony Ship
- choose a highlighted probed or visited unowned star

![Open Fleet — pointer to the FLEET tab to send the Colony Ship](docs/images/OpenFleet.png)

### Stage E — Arrival + Personal Travel

This stage should explicitly contain the player travel requirement.

The tutorial should tell the player:

- the colony ship is in transit
- the player must also travel to the destination
- once there, visit the star and continue the flow

### Stage F — Locate Planet and Colonize

At the destination, the player must:

- locate the marked planet or colony site
- orbit it
- press COLONIZE

The final action should be gated by actual scene state, not just the existence of a ship in fleet or a star in discovery state.

## State Expectations for the Tutorial

The tutorial logic should use real game state, not assumptions:

- whether the player has a probe
- whether the probe has been sent
- whether the colony ship is built
- whether the colony ship is in transit
- whether the player is at the destination star
- whether the player has visited the target star
- whether the marked planet is located and orbited

Any shortcut that bypasses these conditions should be considered incorrect.

## Failure Cases to Prevent

The following should never be treated as valid progression:

- colony ship target selection before probe send
- colony ship launch before building / ready state is satisfied
- colony send while the player has not personally reached the destination
- final COLONIZE button unlocked before the destination is actually reached
- step advancement based only on a panel being open, without checking the underlying ship state

## Admin Reset (QA/Debug)

An admin-only "Reset Colony Tutorial" button (visible in the admin panel to `ADMIN_USERS`) restarts the tutorial at the very first step, regardless of the player's actual ship/build progress:

1. Dismisses any in-progress colonize tutorial session.
2. Restarts it at the `info` step and closes the admin panel so the card is visible immediately.
3. The player sees **EXPAND YOUR EMPIRE** first — not a later step like **SEND YOUR PROBE**.

![Expand Your Empire — first card after reset](docs/images/Expand.png)

The first card reads:

> **EXPAND YOUR EMPIRE**
> Scout a star with a probe, or build
> on your first visit beyond home.
> Then travel there personally to claim it.

### Bug it fixes

Reopening the tutorial via Help → More Tutorials → Colonize calls a "smart resume" helper that derives the starting step from the player's real fleet state (e.g. jumping straight to `send_probe` if a probe is already built). That smart-resume logic used to run unconditionally, so it would silently overwrite an admin-forced reset the moment the tutorial was reopened. The fix makes the smart-resume helper a no-op whenever a colonize tutorial session is already active, so an admin reset (or any in-progress run) is never clobbered.

## Summary

The colonize tutorial is fundamentally a scouting + travel + settlement sequence.

The correct tutorial path is:

Probe → Send Probe → Build Colony Ship → Send Colony Ship → Travel to destination → Visit destination → Orbit planet → COLONIZE

This sequence should be preserved in both the tutorial logic and the documentation, because the false shortcut was the direct cause of the earlier flow bug.
