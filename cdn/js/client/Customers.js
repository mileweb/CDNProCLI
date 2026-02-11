class Customers {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List customers (admin).
   * Common query params: search, status, type, parentId, email, ids, regionalOffices, products, limit, offset
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/ngadmin/customers', { ...reqOptions, query });
  }

  /**
   * Get customer details (admin). id may be "me".
   */
  get(id, reqOptions = {}) {
    if (id === undefined || id === null || id === '') throw new Error('id is required');
    return this.api.request('GET', `/ngadmin/customers/${encodeURIComponent(String(id))}`, reqOptions);
  }

  /** Create a customer (admin). */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/ngadmin/customers', { ...reqOptions, body });
  }

  /** Update a customer (admin). */
  update(id, patchBody, reqOptions = {}) {
    if (id === undefined || id === null || id === '') throw new Error('id is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/ngadmin/customers/${encodeURIComponent(String(id))}`, { ...reqOptions, body: patchBody });
  }
}

module.exports = { Customers };

