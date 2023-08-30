'use strict';

import verifyProvRecord from "/test/suites/data-hub/data-services/provenance/data-hub-provenance/lib/verifyProvenanceRecord.mjs";

xdmp.invokeFunction(() => {
  verifyProvRecord.onStartStep({"latestProvenance": true});
}, {update: "true"});