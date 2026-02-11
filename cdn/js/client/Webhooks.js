class Webhooks {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List webhooks.
   * Common query params: search, offset, limit, sortBy, sortOrder
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/webhooks', { ...reqOptions, query });
  }

  /** Get a webhook by ID. */
  get(id, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    return this.api.request('GET', `/cdn/webhooks/${encodeURIComponent(id)}`, reqOptions);
  }

  /** Create a webhook. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/webhooks', { ...reqOptions, body });
  }

  /** Update a webhook (PATCH). */
  update(id, patchBody, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/webhooks/${encodeURIComponent(id)}`, { ...reqOptions, body: patchBody });
  }

  /** Delete a webhook. */
  delete(id, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    return this.api.request('DELETE', `/cdn/webhooks/${encodeURIComponent(id)}`, reqOptions);
  }
}

module.exports = { Webhooks };

