class Geo {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /** Get client regions (for edge hostname client zone rules). */
  clientRegions(reqOptions = {}) {
    return this.api.request('GET', '/cdn/clientRegions', reqOptions);
  }

  /**
   * Get a list of ISPs (for edge hostname client zone rules).
   * Common query params: sortBy, sortOrder, regionCode
   */
  isps(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/isps', { ...reqOptions, query });
  }
}

module.exports = { Geo };

