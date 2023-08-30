/*
 * Create Content Plugin
 *
 * @param id         - the identifier returned by the collector
 * @param options    - an object containing options. Options are sent from Java
 *
 * @return - your content
 */
function createContent(id, options) {
  let doc = cts.doc(id);
  let root = doc.root;

  // for xml we need to use xpath
  if (root && xdmp.nodeKind(root) === 'element') {
    return root.xpath('/*:envelope/*:instance/node()');
  } else if (root && root.envelope && root.envelope.instance) { // for json we need to return the instance
    return root.envelope.instance;
  } else { // for everything else
    return doc;
  }
}

module.exports = {
  createContent: createContent
};
