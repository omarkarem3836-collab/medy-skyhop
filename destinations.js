import { MEDSKY } from './palette.js';

// Scenic stops in the game journey; these do not describe airline schedules.
export const GATES_PER_DESTINATION = 5;

export const DESTINATIONS = Object.freeze([
  { id: 'malta', name: 'Malta' },
  { id: 'rome', name: 'Rome' },
  { id: 'milan', name: 'Milan' },
  { id: 'athens', name: 'Athens' },
  { id: 'madrid', name: 'Madrid' },
  { id: 'dusseldorf', name: 'Düsseldorf' },
  { id: 'paris', name: 'Paris' },
].map(destination => Object.freeze({
  ...destination,
  label: destination.name,
  landmark: destination.id,
  skyTop: MEDSKY.elegance,
  skyBottom: MEDSKY.pearl,
  accent: MEDSKY.gold,
})));

function journeyPosition(score, startId) {
  const gates = Number.isFinite(score)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(score)))
    : 0;
  const startIndex = Math.max(0, DESTINATIONS.findIndex(destination => destination.id === startId));
  const stopsReached = Math.floor(gates / GATES_PER_DESTINATION);
  return {
    index: (startIndex + stopsReached) % DESTINATIONS.length,
    gatesIntoStop: gates % GATES_PER_DESTINATION,
    stopsReached,
  };
}

export function getDestination(score = 0, startId = 'malta') {
  return DESTINATIONS[journeyPosition(score, startId).index];
}

export function getJourney(score = 0, startId = 'malta') {
  const { index, gatesIntoStop, stopsReached } = journeyPosition(score, startId);
  return {
    destination: DESTINATIONS[index],
    nextDestination: DESTINATIONS[(index + 1) % DESTINATIONS.length],
    gatesIntoStop,
    gatesRemaining: GATES_PER_DESTINATION - gatesIntoStop,
    stopsReached,
    lap: Math.floor(stopsReached / DESTINATIONS.length) + 1,
  };
}
