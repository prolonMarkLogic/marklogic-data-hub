let contentArray;
let options;

contentArray.forEach(content => {
  content.uri = "/overridden/" + content.value.envelope.instance.CustomerID + ".json";
});
