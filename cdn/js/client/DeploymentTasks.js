class DeploymentTasks {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List deployment tasks.
   * Common query params: startdate, enddate, offset, limit, propertyId, certificateId, target,
   *                     search, taskIds, sortBy, sortOrder, status
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/deploymentTasks', { ...reqOptions, query });
  }

  /** Get a deployment task by ID. */
  get(id, reqOptions = {}) {
    if (!id) throw new Error('id is required');
    return this.api.request('GET', `/cdn/deploymentTasks/${encodeURIComponent(id)}`, reqOptions);
  }

  /**
   * Create a deployment task.
   * Optional headers: Check-Certificate: no, Check-Usage: no
   */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/deploymentTasks', { ...reqOptions, body });
  }
}

module.exports = { DeploymentTasks };

