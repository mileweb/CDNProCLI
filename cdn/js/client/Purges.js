class Purges {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /** Create a purge request. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/purges', { ...reqOptions, body });
  }

  /** Get purge request status by ID. */
  get(id, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    return this.api.request('GET', `/cdn/purges/${encodeURIComponent(id)}`, reqOptions);
  }

  /**
   * Get purge summary.
   * Common query params: startdate, enddate, target
   */
  summary(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/purges/purgeSummary', { ...reqOptions, query });
  }

  /**
   * Get available purge tokens.
   * Required query params in spec: target=production|staging
   */
  tokens(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/purges/purgeTokens', { ...reqOptions, query });
  }
}

module.exports = { Purges };

