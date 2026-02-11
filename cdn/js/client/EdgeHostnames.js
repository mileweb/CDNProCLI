class EdgeHostnames {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List edge hostnames.
   * Common query params: search, status, offset, limit, sortBy, sortOrder, hasBeian, serverGroups
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/edgeHostnames', { ...reqOptions, query });
  }

  /** Get an edge hostname by name. */
  get(edgeHostname, reqOptions = {}) {
    if (!edgeHostname) throw new Error('edgeHostname is required');
    return this.api.request('GET', `/cdn/edgeHostnames/${encodeURIComponent(edgeHostname)}`, reqOptions);
  }

  /** Create an edge hostname. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/edgeHostnames', { ...reqOptions, body });
  }

  /**
   * Update an edge hostname (full update via PUT).
   * Spec requires the full object, including fields that are not changing.
   */
  replace(edgeHostname, body, reqOptions = {}) {
    if (!edgeHostname) throw new Error('edgeHostname is required');
    if (!body) throw new Error('body is required');
    return this.api.request('PUT', `/cdn/edgeHostnames/${encodeURIComponent(edgeHostname)}`, { ...reqOptions, body });
  }

  /** Update an edge hostname (partial update via PATCH). */
  update(edgeHostname, patchBody, reqOptions = {}) {
    if (!edgeHostname) throw new Error('edgeHostname is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/edgeHostnames/${encodeURIComponent(edgeHostname)}`, { ...reqOptions, body: patchBody });
  }

  /**
   * Delete an edge hostname.
   * Optional headers: Check-Usage: no (bypass safety check)
   */
  delete(edgeHostname, reqOptions = {}) {
    if (!edgeHostname) throw new Error('edgeHostname is required');
    return this.api.request('DELETE', `/cdn/edgeHostnames/${encodeURIComponent(edgeHostname)}`, reqOptions);
  }
}

module.exports = { EdgeHostnames };

