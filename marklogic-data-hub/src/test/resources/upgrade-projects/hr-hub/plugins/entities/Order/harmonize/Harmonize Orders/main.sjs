// dhf.sjs exposes helper functions to make your life easier
// See documentation at:
// https://github.com/marklogic/marklogic-data-hub/wiki/dhf-lib
const dhf = require('/data-hub/4/dhf.sjs');

const contentPlugin = require('./content/content.sjs');
const headersPlugin = require('./headers/headers.sjs');
const triplesPlugin = require('./triples/triples.sjs');
const writerPlugin = require('./writer/writer.sjs');

/*
 * Plugin Entry point
 *
 * @param id          - the identifier returned by the collector
 * @param options     - a map containing options. Options are sent from Java
 *
 */
function main(id, options) {
  let contentContext = dhf.contentContext();
  let content = dhf.run(contentContext, function() {
    return contentPlugin.createContent(id, options);
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

  // writers must be invoked this way.
  // see: https://github.com/marklogic/marklogic-data-hub/wiki/dhf-lib#run-writer
  dhf.runWriter(writerPlugin, id, envelope, options);
}

module.exports = {
  main: main
};
