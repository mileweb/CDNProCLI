class ResourceSummary {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * Get resource summary.
   * Endpoint: GET /cdn/resourceSummary[?customerId={id}]
   */
  getByCustomer(customerId, reqOptions = {}) {
    if (customerId === undefined || customerId === null || customerId === '') {
      throw new Error('customerId is required');
    }
    return this.api.request('GET', '/cdn/resourceSummary', { ...reqOptions, query: { customerId } });
  }
}

module.exports = { ResourceSummary };

