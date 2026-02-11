class Secrets {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List secrets.
   * Common query params: search, offset, limit, sortBy, sortOrder
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/secrets', { ...reqOptions, query });
  }

  /** Get a secret by ID. */
  get(secretID, reqOptions = {}) {
    if (!secretID) throw new Error('secretID is required');
    return this.api.request('GET', `/cdn/secrets/${encodeURIComponent(secretID)}`, reqOptions);
  }

  /** Create a secret. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/secrets', { ...reqOptions, body });
  }

  /** Update a secret (PATCH). */
  update(secretID, patchBody, reqOptions = {}) {
    if (!secretID) throw new Error('secretID is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/secrets/${encodeURIComponent(secretID)}`, { ...reqOptions, body: patchBody });
  }

  /** Delete a secret. */
  delete(secretID, reqOptions = {}) {
    if (!secretID) throw new Error('secretID is required');
    return this.api.request('DELETE', `/cdn/secrets/${encodeURIComponent(secretID)}`, reqOptions);
  }
}

module.exports = { Secrets };

