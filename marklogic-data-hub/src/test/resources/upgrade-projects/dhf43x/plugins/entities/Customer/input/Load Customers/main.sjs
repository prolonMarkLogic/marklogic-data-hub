// dhf.sjs exposes helper functions to make your life easier
// See documentation at:
// https://marklogic.github.io/marklogic-data-hub/docs/server-side/
const dhf = require('/data-hub/4/dhf.sjs');

const contentPlugin = require('./content.sjs');
const headersPlugin = require('./headers.sjs');
const triplesPlugin = require('./triples.sjs');

/*
 * Plugin Entry point
 *
 * @param id          - the identifier returned by the collector
 * @param rawContent  - the raw content being loaded
 * @param options     - a map containing options. Options are sent from Java
 *
 */
function main(id, rawContent, options) {
  let contentContext = dhf.contentContext(rawContent);
  let content = dhf.run(contentContext, function() {
    return contentPlugin.createContent(id, rawContent, options);
  });

  let headerContext = dhf.headersContext(content);
  let headers = dhf.run(headerContext, function() {
    return headersPlugin.createHeaders(id, content, options);
  });

  let tripleContext = dhf.triplesContext(content, headers);
  let triples = dhf.run(tripleContext, function() {
    return triplesPlugin.createTriples(id, content, headers, options);
  });

  let envelope = dhf.makeEnvelope(content, headers, triples, options.dataFormat);

  // log the final envelope as a trace
  // only fires if tracing is enabled
  dhf.logTrace(dhf.writerContext(envelope));

  return envelope;
}

module.exports = {
  main: main
};
