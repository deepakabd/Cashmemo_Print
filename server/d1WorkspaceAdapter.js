const clone = (value) => value == null ? value : structuredClone(value);

const emptyWorkspace = () => ({
  invoices: [],
  consumers: [],
  adjustments: [],
  inventoryEntries: [],
  _internal: { billingCounters: {}, billingOpeningBalances: {}, invoiceHistory: {} },
});

const collectionKeys = {
  invoices: 'invoices',
  consumers: 'consumers',
  billingAdjustments: 'adjustments',
  inventoryRegister: 'inventoryEntries',
};

const snapshotFor = (id, value) => ({
  id,
  exists: value !== undefined,
  data: () => clone(value),
});

export const createD1WorkspaceAdapter = (userId, userRecord, storedWorkspace) => {
  let state = { ...emptyWorkspace(), ...(clone(storedWorkspace) || {}) };
  state._internal = { ...emptyWorkspace()._internal, ...(state._internal || {}) };
  for (const key of Object.values(collectionKeys)) if (!Array.isArray(state[key])) state[key] = [];

  const bucketFor = (collectionName) => {
    const publicKey = collectionKeys[collectionName];
    if (publicKey) return { kind: 'array', value: state[publicKey] };
    if (Object.hasOwn(state._internal, collectionName)) return { kind: 'object', value: state._internal[collectionName] };
    state._internal[collectionName] = {};
    return { kind: 'object', value: state._internal[collectionName] };
  };

  const valueAt = (collectionName, id) => {
    const bucket = bucketFor(collectionName);
    return bucket.kind === 'array' ? bucket.value.find((item) => item.id === id) : bucket.value[id];
  };

  const setAt = (collectionName, id, value, merge = false) => {
    const bucket = bucketFor(collectionName);
    const next = merge ? { ...(valueAt(collectionName, id) || {}), ...clone(value) } : clone(value);
    if (bucket.kind === 'array') {
      const index = bucket.value.findIndex((item) => item.id === id);
      const record = { ...next, id };
      if (index < 0) bucket.value.push(record); else bucket.value[index] = record;
    } else bucket.value[id] = next;
  };

  const deleteAt = (collectionName, id) => {
    const bucket = bucketFor(collectionName);
    if (bucket.kind === 'array') {
      const index = bucket.value.findIndex((item) => item.id === id);
      if (index >= 0) bucket.value.splice(index, 1);
    } else delete bucket.value[id];
  };

  const document = (collectionName, id) => ({
    id,
    _collectionName: collectionName,
    get: async () => snapshotFor(id, valueAt(collectionName, id)),
    collection: (nestedName) => collection(nestedName),
  });

  const collection = (collectionName) => ({
    doc: (id) => document(collectionName, id),
    get: async () => {
      const bucket = bucketFor(collectionName);
      const records = bucket.kind === 'array' ? bucket.value : Object.entries(bucket.value).map(([id, value]) => ({ ...value, id }));
      return { docs: records.map((record) => snapshotFor(record.id, record)) };
    },
  });

  const firestore = {
    collection: (name) => {
      if (name !== 'users') return collection(name);
      return {
        doc: (id) => ({
          id,
          get: async () => snapshotFor(id, id === userId ? userRecord : undefined),
          collection,
        }),
      };
    },
    runTransaction: async (callback) => {
      const before = clone(state);
      try {
        return await callback({
          get: async (ref) => ref.get(),
          set: (ref, value, options) => setAt(ref._collectionName, ref.id, value, Boolean(options?.merge)),
          update: (ref, value) => setAt(ref._collectionName, ref.id, value, true),
          delete: (ref) => deleteAt(ref._collectionName, ref.id),
        });
      } catch (error) {
        state = before;
        throw error;
      }
    },
  };

  return {
    firestore,
    snapshot: () => clone(state),
  };
};
