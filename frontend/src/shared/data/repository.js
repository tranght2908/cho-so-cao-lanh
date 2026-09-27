/* Shared data-access foundation for the legacy prototype migration. */
(function (A) {
  'use strict';

  if (!A) return;

  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const data = A.data || (A.data = {});
  const sources = data._sources || (data._sources = Object.create(null));

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

  // Feature-specific legacy sources can be registered without teaching this
  // shared adapter about any business domain or storage implementation.
  data.registerSource = function (name, source) {
    if (typeof name !== 'string' || !name || !source) return null;
    if (!sources[name]) sources[name] = source;
    return sources[name];
  };

  data.getSource = function (name) {
    return typeof name === 'string' ? sources[name] || null : null;
  };
})(window.APP);
