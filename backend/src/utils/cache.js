class MemoryCache {
  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  _isExpired(record) {
    return !record || record.expiresAt <= Date.now();
  }

  get(key) {
    const record = this.store.get(key);
    if (this._isExpired(record)) {
      if (record) {
        this.store.delete(key);
      }
      return null;
    }

    return record.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  getOrSet(key, builder, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = builder();
    this.set(key, value, ttlMs);
    return value;
  }

  clear() {
    this.store.clear();
  }
}

module.exports = {
  MemoryCache,
};