class Report {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * Generic POST helper for /cdn/report/* endpoints.
   * Most report endpoints are POST with optional query params like startdate/enddate.
   */
  post(endpointPath, { query = {}, body = {} } = {}, reqOptions = {}) {
    if (!endpointPath) throw new Error('endpointPath is required');
    const path = endpointPath.startsWith('/cdn/report/') ? endpointPath : `/cdn/report/${endpointPath.replace(/^\/+/, '')}`;
    return this.api.request('POST', path, { ...reqOptions, query, body });
  }

  /** Bandwidth report. */
  bandwidth(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/bandwidth', { query, body }, reqOptions);
  }

  /** Volume summary report (used in existing scripts as /cdn/report/volSummary). */
  volSummary(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/volSummary', { query, body }, reqOptions);
  }

  /** Request summary report (used in existing scripts as /cdn/report/reqSummary). */
  reqSummary(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/reqSummary', { query, body }, reqOptions);
  }

  /** Volume report. */
  vol(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/vol', { query, body }, reqOptions);
  }

  /** Request report. */
  req(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/req', { query, body }, reqOptions);
  }

  /** CPU time report. */
  cpuTime(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/cpuTime', { query, body }, reqOptions);
  }

  /**
   * Log configuration management lives under /cdn/report/logConfigs
   * These are not time-series reports, but are grouped under "report" in the API.
   */
  listLogConfigs(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/report/logConfigs', { ...reqOptions, query });
  }

  createLogConfig(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/report/logConfigs', { ...reqOptions, body });
  }

  getLogConfig(id, reqOptions = {}) {
    if (id === undefined || id === null || id === '') throw new Error('id is required');
    return this.api.request('GET', `/cdn/report/logConfigs/${encodeURIComponent(String(id))}`, reqOptions);
  }

  updateLogConfig(id, patchBody, reqOptions = {}) {
    if (id === undefined || id === null || id === '') throw new Error('id is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/report/logConfigs/${encodeURIComponent(String(id))}`, { ...reqOptions, body: patchBody });
  }

  deleteLogConfig(id, reqOptions = {}) {
    if (id === undefined || id === null || id === '') throw new Error('id is required');
    return this.api.request('DELETE', `/cdn/report/logConfigs/${encodeURIComponent(String(id))}`, reqOptions);
  }

  /** Request log download URLs for access logs. */
  logDownload(query = {}, body = {}, reqOptions = {}) {
    return this.post('/cdn/report/logDownload', { query, body }, reqOptions);
  }
}

module.exports = { Report };

