import { beforeEach, describe, expect, it } from 'vitest';
import {
  canUseTutorialProbeFuelBypass,
  colonizationTopicAction,
  consumeTutorialProbeFuelBypass,
  dismissColonizationWaitNotice,
  dismissColonizationTopic,
  getColonizationTopicStep,
  getProbeBuildCompleteAt,
  isColonizationWaitNoticeDismissed,
  setProbeBuildCompleteAt,
  startColonizationTopic,
} from '../coach';
import { isValidTransferTargetForShip } from '../renderer';

type StarFixture = {
  index: number;
  pos: { x: number; y: number };
  owner: 'none' | 'player' | 'foreign';
  discoveryLevel: 'none' | 'probed' | 'visited';
};

describe('colonization tutorial flow', () => {
  beforeEach(() => {
    dismissColonizationTopic();
  });

  it('waits for the probe to finish building before moving on', () => {
    startColonizationTopic(false, 'build_probe');
    expect(getColonizationTopicStep()).toBe('build_probe');

    setProbeBuildCompleteAt(Date.now() + 8000);
    colonizationTopicAction('probe_built');
    expect(getColonizationTopicStep()).toBe('probe_building');

    // Colony build must not proceed while the probe is still under construction.
    colonizationTopicAction('colony_built');
    expect(getColonizationTopicStep()).toBe('probe_building');

    colonizationTopicAction('probe_ready');
    expect(getColonizationTopicStep()).toBe('build_colony');
    expect(getProbeBuildCompleteAt()).toBeNull();
  });

  it('pauses the tutorial while the colony ship is building, then resumes at the fleet send step', () => {
    startColonizationTopic(false, 'build_colony');
    expect(getColonizationTopicStep()).toBe('build_colony');

    colonizationTopicAction('colony_build_started');
    expect(getColonizationTopicStep()).toBe('colony_building');

    colonizationTopicAction('colony_built');
    expect(getColonizationTopicStep()).toBe('open_fleet');

    colonizationTopicAction('fleet_opened');
    expect(getColonizationTopicStep()).toBe('send_colony');

    colonizationTopicAction('colony_sent');
    expect(getColonizationTopicStep()).toBe('arrival');
  });

  it('allows a single tutorial-only fuel bypass for the probe send step', () => {
    startColonizationTopic(false, 'send_probe');
    expect(canUseTutorialProbeFuelBypass()).toBe(true);
    expect(consumeTutorialProbeFuelBypass()).toBe(true);
    expect(canUseTutorialProbeFuelBypass()).toBe(false);
    expect(consumeTutorialProbeFuelBypass()).toBe(false);
  });

  it('resumes the tutorial after the colony ship build completes', () => {
    startColonizationTopic(false, 'colony_building');
    expect(isColonizationWaitNoticeDismissed()).toBe(false);
    dismissColonizationWaitNotice();
    expect(isColonizationWaitNoticeDismissed()).toBe(true);
    colonizationTopicAction('colony_built');
    expect(getColonizationTopicStep()).toBe('open_fleet');
    expect(isColonizationWaitNoticeDismissed()).toBe(false);
  });

  it('keeps tutorial probe targets valid even when nearby stars are already discovered', () => {
    const galaxy: { homeStarIndex: number; stars: StarFixture[] } = {
      homeStarIndex: 13,
      stars: Array.from({ length: 100 }, (_, idx) => ({
        index: idx,
        pos: { x: 0, y: 0 },
        owner: 'none' as const,
        discoveryLevel: 'none' as const,
      })),
    };
    galaxy.stars[13] = { index: 13, pos: { x: 0, y: 0 }, owner: 'player', discoveryLevel: 'visited' };
    galaxy.stars[71] = { index: 71, pos: { x: 8, y: 0 }, owner: 'foreign', discoveryLevel: 'visited' };
    galaxy.stars[99] = { index: 99, pos: { x: 0, y: 20 }, owner: 'player', discoveryLevel: 'visited' };

    expect(isValidTransferTargetForShip(galaxy, 13, 11, galaxy.stars[71], true)).toBe(true);
    expect(isValidTransferTargetForShip(galaxy, 13, 11, galaxy.stars[99], true)).toBe(false);
  });

  it('allows Colony Ships only to visited unclaimed stars', () => {
    const galaxy = {
      homeStarIndex: 13,
      stars: [
        { index: 13, pos: { x: 0, y: 0 }, owner: 'player', discoveryLevel: 'visited' },
        { index: 71, pos: { x: 8, y: 0 }, owner: 'none', discoveryLevel: 'visited' },
        { index: 72, pos: { x: 8, y: 1 }, owner: 'none', discoveryLevel: 'probed' },
        { index: 73, pos: { x: 8, y: 2 }, owner: 'none', discoveryLevel: 'none' },
        { index: 74, pos: { x: 8, y: 3 }, owner: 'player', discoveryLevel: 'visited' },
      ],
    };

    expect(isValidTransferTargetForShip(galaxy, 13, 8, galaxy.stars[1]!, true)).toBe(true);
    expect(isValidTransferTargetForShip(galaxy, 13, 8, galaxy.stars[2]!, true)).toBe(false);
    expect(isValidTransferTargetForShip(galaxy, 13, 8, galaxy.stars[3]!, true)).toBe(false);
    expect(isValidTransferTargetForShip(galaxy, 13, 8, galaxy.stars[4]!, true)).toBe(false);
  });
});
