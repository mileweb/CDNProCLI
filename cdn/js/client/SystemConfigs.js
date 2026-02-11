class SystemConfigs {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /** Get system configuration. */
  get(reqOptions = {}) {
    return this.api.request('GET', '/cdn/systemConfigs', reqOptions);
  }

  /**
   * Update system configuration (PATCH).
   * Note: Some deployments expose this endpoint even if it isn't documented in all specs.
   */
  update(patchBody, reqOptions = {}) {
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', '/cdn/systemConfigs', { ...reqOptions, body: patchBody });
  }
}

module.exports = { SystemConfigs };

