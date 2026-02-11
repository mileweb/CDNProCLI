class Validations {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List property validation tasks.
   * Common query params: search, status, offset, limit, sortBy, sortOrder, startdate, enddate, propertyId
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/validations', { ...reqOptions, query });
  }

  /** Get one validation task by ID. */
  get(id, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    return this.api.request('GET', `/cdn/validations/${encodeURIComponent(id)}`, reqOptions);
  }

  /**
   * Create a validation task.
   * Note: the exact endpoint for creating validations can vary; if your spec exposes POST /cdn/validations,
   * this method will work. If your deployment uses a different validation creation endpoint, use client.request().
   */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/validations', { ...reqOptions, body });
  }
}

module.exports = { Validations };

