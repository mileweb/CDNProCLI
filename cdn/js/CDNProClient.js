const { ApiCore } = require('./client/ApiCore');
const { Properties } = require('./client/Properties');
const { Certificates } = require('./client/Certificates');
const { EdgeHostnames } = require('./client/EdgeHostnames');
const { Secrets } = require('./client/Secrets');
const { DeploymentTasks } = require('./client/DeploymentTasks');
const { ServiceQuotas } = require('./client/ServiceQuotas');
const { Report } = require('./client/Report');
const { SystemConfigs } = require('./client/SystemConfigs');
const { Customers } = require('./client/Customers');
const { Validations } = require('./client/Validations');
const { Webhooks } = require('./client/Webhooks');
const { Purges } = require('./client/Purges');
const { Geo } = require('./client/Geo');
const { ResourceSummary } = require('./client/ResourceSummary');

/**
 * CDN Pro API client.
 *
 * serverInfo example:
 *   { host: 'ngapi.cdnetworks.com', user: '...', secretKey: '...' }
 *
 * Optional fields supported by underlying request layer:
 *   { family: 4 }  // force IPv4 (Node https Agent option)
 */
class CDNProClient {
  constructor(serverInfo) {
    this.serverInfo = serverInfo;
    this._api = new ApiCore(serverInfo);

    // Resources
    this.properties = new Properties(this._api);
    this.certificates = new Certificates(this._api);
    this.edgeHostnames = new EdgeHostnames(this._api);
    this.secrets = new Secrets(this._api);
    this.deployments = new DeploymentTasks(this._api);
    this.deploymentTasks = this.deployments; // alias
    this.serviceQuotas = new ServiceQuotas(this._api);
    this.report = new Report(this._api);
    this.systemConfigs = new SystemConfigs(this._api);
    this.customers = new Customers(this._api);
    this.validations = new Validations(this._api);
    this.webhooks = new Webhooks(this._api);
    this.purges = new Purges(this._api);
    this.geo = new Geo(this._api);
    this.resourceSummary = new ResourceSummary(this._api);
  }

  /**
   * Low-level escape hatch to call any endpoint.
   * Prefer using resource wrappers when available.
   */
  request(method, path, reqOptions = {}) {
    return this._api.request(method, path, reqOptions);
  }
}

module.exports = { CDNProClient };

