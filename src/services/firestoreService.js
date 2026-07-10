// Firestore entity service — provides CRUD operations backed by Firestore.
// Falls back to in-memory storage when Firebase is not configured.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { auth } from './firebase';

// In-memory fallback store for offline/unconfigured mode
const _memStore = {};

function getMemCollection(collectionName) {
  if (!_memStore[collectionName]) _memStore[collectionName] = [];
  return _memStore[collectionName];
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getCurrentUserId() {
  if (!isFirebaseConfigured || !auth) return 'local-user';
  return auth.currentUser?.uid || 'anonymous';
}

// Map sort string like '-created_date' to Firestore field/direction
function parseSortString(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith('-');
  const field = sortStr.replace(/^-/, '');
  // Normalize field names
  const fieldMap = {
    created_date: 'created_date',
    updated_date: 'updated_date',
    importance: 'importance',
  };
  return { field: fieldMap[field] || field, direction: desc ? 'desc' : 'asc' };
}

/** Build an entity service for a specific Firestore collection. */
function createEntityService(collectionName) {
  async function getCollectionRef() {
    if (!isFirebaseConfigured || !db) return null;
    return collection(db, collectionName);
  }

  const service = {
    /** List documents with optional sort and limit. */
    async list(sortStr, maxItems = 100) {
      if (!isFirebaseConfigured || !db) {
        const items = getMemCollection(collectionName).slice();
        return items.slice(0, maxItems);
      }
      try {
        const colRef = collection(db, collectionName);
        const constraints = [];
        const sort = parseSortString(sortStr);
        if (sort) constraints.push(orderBy(sort.field, sort.direction));
        constraints.push(firestoreLimit(maxItems));
        const q = query(colRef, ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.list failed:`, err.message);
        return getMemCollection(collectionName).slice(0, maxItems);
      }
    },

    /** Filter documents by a field-value map. */
    async filter(filters = {}, sortStr, maxItems = 100) {
      if (!isFirebaseConfigured || !db) {
        const mem = getMemCollection(collectionName);
        const filtered = mem.filter((item) =>
          Object.entries(filters).every(([k, v]) => item[k] === v)
        );
        return filtered.slice(0, maxItems);
      }
      try {
        const colRef = collection(db, collectionName);
        const constraints = Object.entries(filters).map(([k, v]) => where(k, '==', v));
        const sort = parseSortString(sortStr);
        if (sort) constraints.push(orderBy(sort.field, sort.direction));
        constraints.push(firestoreLimit(maxItems));
        const q = query(colRef, ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.filter failed:`, err.message);
        const mem = getMemCollection(collectionName);
        return mem
          .filter((item) => Object.entries(filters).every(([k, v]) => item[k] === v))
          .slice(0, maxItems);
      }
    },

    /** Create a new document. */
    async create(data) {
      const now = new Date().toISOString();
      const userId = getCurrentUserId();
      const enriched = {
        created_date: now,
        updated_date: now,
        created_by_id: userId,
        ...data,
      };
      if (!isFirebaseConfigured || !db) {
        const id = genId();
        const record = { id, ...enriched };
        getMemCollection(collectionName).push(record);
        return record;
      }
      try {
        const colRef = collection(db, collectionName);
        const docRef = await addDoc(colRef, enriched);
        return { id: docRef.id, ...enriched };
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.create failed:`, err.message);
        const id = genId();
        const record = { id, ...enriched };
        getMemCollection(collectionName).push(record);
        return record;
      }
    },

    /** Update a document by ID. */
    async update(id, patch) {
      const now = new Date().toISOString();
      const enriched = { ...patch, updated_date: now };
      if (!isFirebaseConfigured || !db) {
        const mem = getMemCollection(collectionName);
        const idx = mem.findIndex((item) => item.id === id);
        if (idx !== -1) mem[idx] = { ...mem[idx], ...enriched };
        return idx !== -1 ? mem[idx] : null;
      }
      try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, enriched);
        const snap = await getDoc(docRef);
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.update failed:`, err.message);
        const mem = getMemCollection(collectionName);
        const idx = mem.findIndex((item) => item.id === id);
        if (idx !== -1) mem[idx] = { ...mem[idx], ...enriched };
        return idx !== -1 ? mem[idx] : null;
      }
    },

    /** Delete a document by ID. */
    async delete(id) {
      if (!isFirebaseConfigured || !db) {
        const mem = getMemCollection(collectionName);
        const idx = mem.findIndex((item) => item.id === id);
        if (idx !== -1) mem.splice(idx, 1);
        return;
      }
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.delete failed:`, err.message);
        const mem = getMemCollection(collectionName);
        const idx = mem.findIndex((item) => item.id === id);
        if (idx !== -1) mem.splice(idx, 1);
      }
    },

    /** Delete many documents matching a filter. */
    async deleteMany(filters = {}) {
      const items = await service.filter(filters, null, 1000);
      if (!isFirebaseConfigured || !db) {
        for (const item of items) await service.delete(item.id);
        return;
      }
      try {
        const batch = writeBatch(db);
        for (const item of items) {
          batch.delete(doc(db, collectionName, item.id));
        }
        await batch.commit();
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.deleteMany failed:`, err.message);
        for (const item of items) await service.delete(item.id);
      }
    },

    /** Bulk create documents. */
    async bulkCreate(records) {
      if (!isFirebaseConfigured || !db) {
        return Promise.all(records.map((r) => service.create(r)));
      }
      try {
        const batch = writeBatch(db);
        const colRef = collection(db, collectionName);
        const now = new Date().toISOString();
        const userId = getCurrentUserId();
        const enriched = records.map((r) => ({
          created_date: now,
          updated_date: now,
          created_by_id: userId,
          ...r,
        }));
        const refs = enriched.map(() => doc(colRef));
        for (let i = 0; i < refs.length; i++) {
          batch.set(refs[i], enriched[i]);
        }
        await batch.commit();
        return refs.map((ref, i) => ({ id: ref.id, ...enriched[i] }));
      } catch (err) {
        console.warn(`[Firestore] ${collectionName}.bulkCreate failed:`, err.message);
        return Promise.all(records.map((r) => service.create(r)));
      }
    },
  };

  return service;
}

// Pre-built entity services matching the Base44 entity API shape
export const entities = {
  Memory: createEntityService('memories'),
  ChatMessage: createEntityService('chat_messages'),
  Conversation: createEntityService('conversations'),
  ImprovementProposal: createEntityService('improvement_proposals'),
  ToolAction: createEntityService('tool_actions'),
  User: createEntityService('users'),
};
