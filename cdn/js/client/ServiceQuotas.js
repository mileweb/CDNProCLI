class ServiceQuotas {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List service quotas.
   * Common query params: search, status, allowProduction, usageLimit, contractId,
   *                     allowedCacheDirectives, accountManagerEmail, advancedFeatures, offset, limit
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/serviceQuotas', { ...reqOptions, query });
  }

  /** Create a service quota for a customer (reseller). */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/serviceQuotas', { ...reqOptions, body });
  }

  /** Get a service quota by service quota ID. */
  get(serviceQuotaId, reqOptions = {}) {
    if (!serviceQuotaId) throw new Error('serviceQuotaId is required');
    return this.api.request('GET', `/cdn/serviceQuotas/${encodeURIComponent(serviceQuotaId)}`, reqOptions);
  }

  /** Get the service quota for a customer. customerId can be "me" for read. */
  getByCustomer(customerId, reqOptions = {}) {
    if (!customerId) throw new Error('customerId is required');
    return this.api.request('GET', `/cdn/serviceQuotas/customer/${encodeURIComponent(String(customerId))}`, reqOptions);
  }

  /** Update a service quota by service quota ID (PATCH). */
  update(serviceQuotaId, patchBody, reqOptions = {}) {
    if (!serviceQuotaId) throw new Error('serviceQuotaId is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/serviceQuotas/${encodeURIComponent(serviceQuotaId)}`, { ...reqOptions, body: patchBody });
  }

  /** Update a service quota by customer ID (PATCH). */
  updateByCustomer(customerId, patchBody, reqOptions = {}) {
    if (!customerId) throw new Error('customerId is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/serviceQuotas/customer/${encodeURIComponent(String(customerId))}`, {
      ...reqOptions,
      body: patchBody,
    });
  }
}

module.exports = { ServiceQuotas };

