let contentArray;
let options;

// This is passed in because it's defined in the interceptors config in the flow file
let headerValueToAdd;

contentArray.forEach(content => {
  content.value.envelope.headers.hello = headerValueToAdd;
  content.value.envelope.headers.addHeadersDatabase = xdmp.databaseName(xdmp.database());
});
