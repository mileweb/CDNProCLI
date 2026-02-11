class Properties {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List properties.
   * Common query params: search, hasConfig, target, sortBy, sortOrder, tags, legacyType, isHcdn, limit, offset
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/properties', { ...reqOptions, query });
  }

  /** Get a property summary by ID. */
  get(propertyID, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    return this.api.request('GET', `/cdn/properties/${encodeURIComponent(propertyID)}`, reqOptions);
  }

  /** Create a property. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/properties', { ...reqOptions, body });
  }

  /** Update a property (PATCH). */
  update(propertyID, patchBody, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/properties/${encodeURIComponent(propertyID)}`, { ...reqOptions, body: patchBody });
  }

  /** Delete a property. */
  delete(propertyID, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    return this.api.request('DELETE', `/cdn/properties/${encodeURIComponent(propertyID)}`, reqOptions);
  }

  /** List versions of a property. */
  listVersions(propertyID, query = {}, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    return this.api.request('GET', `/cdn/properties/${encodeURIComponent(propertyID)}/versions`, { ...reqOptions, query });
  }

  /** Create a new property version. */
  createVersion(propertyID, body, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    if (!body) throw new Error('body is required');
    return this.api.request('POST', `/cdn/properties/${encodeURIComponent(propertyID)}/versions`, { ...reqOptions, body });
  }

  /** Get one property version (full configuration). */
  getVersion(propertyID, version, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    if (version === undefined || version === null || version === '') throw new Error('version is required');
    return this.api.request(
      'GET',
      `/cdn/properties/${encodeURIComponent(propertyID)}/versions/${encodeURIComponent(String(version))}`,
      reqOptions,
    );
  }

  /** Update one property version (full replace via PUT). */
  updateVersion(propertyID, version, body, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    if (version === undefined || version === null || version === '') throw new Error('version is required');
    if (!body) throw new Error('body is required');
    return this.api.request(
      'PUT',
      `/cdn/properties/${encodeURIComponent(propertyID)}/versions/${encodeURIComponent(String(version))}`,
      { ...reqOptions, body },
    );
  }

  /** Delete one property version. */
  deleteVersion(propertyID, version, reqOptions = {}) {
    if (!propertyID) throw new Error('propertyID is required');
    if (version === undefined || version === null || version === '') throw new Error('version is required');
    return this.api.request(
      'DELETE',
      `/cdn/properties/${encodeURIComponent(propertyID)}/versions/${encodeURIComponent(String(version))}`,
      reqOptions,
    );
  }
}

module.exports = { Properties };

