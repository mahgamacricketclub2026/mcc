import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  update,
  onValue,
  onDisconnect,
  set,
  get,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { firebaseConfig } from "../firebase/firebase-config.js?v=20260519a";
import { clean } from "./live-sync.js?v=20260519a";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const realtimeDb = getDatabase(app);

export function livePath(matchId) {
  return `liveMatches/${matchId}`;
}

export function listenLiveMatch(matchId, callback, onError) {
  if (!matchId) return () => {};
  return onValue(ref(realtimeDb, livePath(matchId)), snap => callback(snap.exists() ? snap.val() : null), onError);
}

export function writeLiveMatch(matchId, payload) {
  return update(ref(realtimeDb, livePath(matchId)), clean({ ...payload, updatedAt: serverTimestamp() }));
}

export async function readLiveMatch(matchId) {
  if (!matchId) return null;
  const snap = await get(ref(realtimeDb, livePath(matchId)));
  return snap.exists() ? snap.val() : null;
}

export function removeLiveMatch(matchId) {
  if (!matchId) return Promise.resolve();
  return remove(ref(realtimeDb, livePath(matchId)));
}

export function patchLiveMatch(matchId, patch) {
  return update(ref(realtimeDb, livePath(matchId)), clean({ ...patch, updatedAt: serverTimestamp() }));
}

export function trackViewer(matchId, viewerId, onCount) {
  const id = viewerId || `viewer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const viewerRef = ref(realtimeDb, `viewerStats/${matchId}/viewers/${id}`);
  const viewersRef = ref(realtimeDb, `viewerStats/${matchId}/viewers`);
  set(viewerRef, { online: true, lastViewedAt: serverTimestamp() }).catch(console.warn);
  onDisconnect(viewerRef).remove();
  return onValue(viewersRef, snap => onCount(Object.keys(snap.val() || {}).length));
}
