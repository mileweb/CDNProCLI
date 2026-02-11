class Certificates {
  constructor(apiCore) {
    this.api = apiCore;
  }

  /**
   * List certificates.
   * Common query params: search, status, offset, limit, sortBy, sortOrder, caOnly, target
   */
  list(query = {}, reqOptions = {}) {
    return this.api.request('GET', '/cdn/certificates', { ...reqOptions, query });
  }

  /** Get a certificate by ID. */
  get(certificateID, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    return this.api.request('GET', `/cdn/certificates/${encodeURIComponent(certificateID)}`, reqOptions);
  }

  /** Create a certificate. */
  create(body, reqOptions = {}) {
    if (!body) throw new Error('body is required');
    return this.api.request('POST', '/cdn/certificates', { ...reqOptions, body });
  }

  /** Update a certificate (creates new version when newVersion is provided). */
  update(certificateID, patchBody, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    if (!patchBody) throw new Error('patchBody is required');
    return this.api.request('PATCH', `/cdn/certificates/${encodeURIComponent(certificateID)}`, { ...reqOptions, body: patchBody });
  }

  /** Delete a certificate. */
  delete(certificateID, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    return this.api.request('DELETE', `/cdn/certificates/${encodeURIComponent(certificateID)}`, reqOptions);
  }

  /**
   * Download CSR for a certificate.
   * Optional query: { dcv: 'sectigo' } to request DCV file.
   */
  downloadCSR(certificateID, query = {}, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    return this.api.request('GET', `/cdn/certificates/${encodeURIComponent(certificateID)}/csr`, { ...reqOptions, query });
  }

  /** Get certificate version details by version number. */
  getVersion(certificateID, version, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    if (version === undefined || version === null || version === '') throw new Error('version is required');
    return this.api.request(
      'GET',
      `/cdn/certificates/${encodeURIComponent(certificateID)}/versions/${encodeURIComponent(String(version))}`,
      reqOptions,
    );
  }

  /** Delete a certificate version (commonly used to delete the latest unused version). */
  deleteVersion(certificateID, version, reqOptions = {}) {
    if (!certificateID) throw new Error('certificateID is required');
    if (version === undefined || version === null || version === '') throw new Error('version is required');
    return this.api.request(
      'DELETE',
      `/cdn/certificates/${encodeURIComponent(certificateID)}/versions/${encodeURIComponent(String(version))}`,
      reqOptions,
    );
  }
}

module.exports = { Certificates };

