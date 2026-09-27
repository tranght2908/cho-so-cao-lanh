/* Shared data-access foundation for the legacy prototype migration. */
(function (A) {
  'use strict';

  if (!A) return;

  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const data = A.data || (A.data = {});

  // This adapter intentionally returns the existing A.db references. Phase 2 does
  // not migrate state or change legacy mutation semantics; future repositories
  // should treat values returned by getCollection as read-only unless a command
  // explicitly performs a save through this adapter.
  data.getDb = function () {
    return A.db;
  };

  data.getCollection = function (name) {
    const db = A.db;
    return db && typeof name === 'string' && own(db, name) ? db[name] : null;
  };

  data.findById = function (collectionName, id) {
    const collection = data.getCollection(collectionName);
    if (!Array.isArray(collection)) return null;
    return collection.find(item => item && item.id === id) || null;
  };

  data.save = function () {
    if (typeof A.save !== 'function') throw new Error('Legacy save adapter is unavailable.');
    return A.save();
  };
})(window.APP);
