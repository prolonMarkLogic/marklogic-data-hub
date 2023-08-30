'use strict';

import config from "/com.marklogic.hub/config.mjs";
import consts from "/data-hub/5/impl/consts.mjs";
import entityLib from "/data-hub/5/impl/entity-lib.mjs";
import httpUtils from "/data-hub/5/impl/http-utils.mjs";
import hubUtils from "/data-hub/5/impl/hub-utils.mjs";
import mappingLib from "/data-hub/5/mapping/mapping-lib.mjs";
import mappingStepLib from "/data-hub/5/builtins/steps/mapping/default/lib.mjs";
import flowUtils from "/data-hub/5/impl/flow-utils.mjs";
const json=require("/MarkLogic/json/json.xqy");
const memOp = require("/mlpm_modules/XQuery-XML-Memory-Operations/memory-operations.xqy");

const inst = require('/MarkLogic/entity-services/entity-services-instance');
const infoEvent = consts.TRACE_MAPPING;
const infoEnabled = xdmp.traceEnabled(infoEvent);
const debugEvent = consts.TRACE_MAPPING_DEBUG;
const debugEnabled = xdmp.traceEnabled(debugEvent);

let xqueryLib = null;

const xmlMappingCollections = ['http://marklogic.com/entity-services/mapping', 'http://marklogic.com/data-hub/mappings/xml'];
const entitiesByTargetType = {};

const xsltPermissions = [
  xdmp.permission(consts.DATA_HUB_COMMON_ROLE, 'execute'),
  xdmp.permission(consts.DATA_HUB_COMMON_ROLE, 'read'),
  xdmp.permission(consts.DATA_HUB_DEVELOPER_ROLE, 'execute'),
  xdmp.permission(consts.DATA_HUB_DEVELOPER_ROLE, 'read'),
  xdmp.permission(consts.DATA_HUB_DEVELOPER_ROLE, 'update'),
  xdmp.permission(consts.DATA_HUB_MAPPING_READ_ROLE, 'read'),
  xdmp.permission(consts.DATA_HUB_MAPPING_WRITE_ROLE, 'update'),
  xdmp.permission(consts.DATA_HUB_MODULE_READER_ROLE, 'read'),
  xdmp.permission(consts.DATA_HUB_MODULE_WRITER_ROLE, 'update'),
  xdmp.permission(consts.DATA_HUB_MODULE_READER_ROLE, "execute"),
  // In the absence of this, ML will report an error about standard-library.xqy not being found. This is misleading; the
  // actual problem is that a mapping will fail if the XML or XSLT representation of a mapping does not have this
  // permission on it, which is expected to be on every other DHF module
  xdmp.permission("rest-extension-user", "execute")
];

const reservedNamespaces = ['m', 'map'];

/**
 * Build an XML mapping template in the http://marklogic.com/entity-services/mapping namespace, which can then be the
 * input to the Entity Services mappingPut function that generates an XSLT template.
 *
 * @param mappingStep expected to be an object
 * @param userParameterNames
 * @return {*}
 */
function buildMappingXML(mappingStep, userParameterNames) {
  if (debugEnabled) {
    hubUtils.hubTrace(debugEvent, 'Building mapping XML');
  }

  let allEntityMap = [];
  let targetEntityMapping = {};

  targetEntityMapping.targetEntityType = mappingStep.targetEntityType;
  targetEntityMapping.properties = mappingStep.properties;
  targetEntityMapping.expressionContext = mappingStep.expressionContext ? mappingStep.expressionContext : "/";
  targetEntityMapping.uriExpression = mappingStep.uriExpression ? mappingStep.uriExpression : "$URI";

  allEntityMap.push(targetEntityMapping);
  if (mappingStep["relatedEntityMappings"] && mappingStep["relatedEntityMappings"].length > 0) {
    mappingStep["relatedEntityMappings"].forEach(entityMap => {
      entityMap.expressionContext = entityMap.expressionContext ? entityMap.expressionContext : "/";
      entityMap.uriExpression = entityMap.uriExpression ? entityMap.uriExpression : "hubURI('" + getEntityName(entityMap.targetEntityType) + "')";
      allEntityMap.push(entityMap);
    });
  }

  const namespaces = fetchNamespacesFromMappingStep(mappingStep);

  let entityTemplates = "";
  for (let i=0; i< allEntityMap.length; i++) {
    entityTemplates += generateEntityTemplates(i, allEntityMap[i]).join('\n') + "\n";
  }
  let xml =
    `<m:mapping xmlns:m="http://marklogic.com/entity-services/mapping" xmlns:instance="http://marklogic.com/datahub/entityInstance" xmlns:map="http://marklogic.com/xdmp/map" ${namespaces.join(' ')}>
      ${retrieveFunctionImports(allEntityMap)}
      ${makeParameterElements(mappingStep, userParameterNames)}
      ${entityTemplates}
      <m:output>
      ${allEntityMap.map((entityMap, index) =>
    `<instance:mapping${index}Instances>
           <m:for-each>
           <m:select>${entityMap["expressionContext"] ? entityMap["expressionContext"]: "/" }</m:select>
           <instance:entityInstance>
               <uri>
                    <m:val>${entityMap.uriExpression}</m:val>
                </uri>
                <value>
                    <m:call-template name="mapping${index}-${getEntityName(entityMap.targetEntityType)}"/>
                </value>
            </instance:entityInstance>
           </m:for-each>
        </instance:mapping${index}Instances>`).join("\n")}
      </m:output>
    </m:mapping>`;
  return xdmp.unquote(xml);
}

function fetchNamespacesFromMappingStep(mappingStep) {
  let namespaces = [];
  if (mappingStep.namespaces) {
    for (const prefix of Object.keys(mappingStep.namespaces).sort()) {
      if (mappingStep.namespaces.hasOwnProperty(prefix)) {
        if (reservedNamespaces.includes(prefix)) {
          throw new Error(`'${prefix}' is a reserved namespace.`);
        }
        namespaces.push(`xmlns:${prefix}="${mappingStep.namespaces[prefix]}"`);
      }
    }
  }
  return namespaces;
}

function getMappingNamespacesObject(mappingStep) {
  let namespaces = {};
  if (mappingStep.namespaces) {
    for (const prefix of Object.keys(mappingStep.namespaces).sort()) {
      if (mappingStep.namespaces.hasOwnProperty(prefix)) {
        if (!reservedNamespaces.includes(prefix)) {
          namespaces[prefix]=mappingStep.namespaces[prefix];
        }
      }
    }
  }
  return namespaces;
}

/**
 * Makes parameter elements for the XML mapping template, which are then converted into XSLT parameter elements.
 *
 * @param mappingStep
 * @param userParameterNames can be passed in for a scenario where the caller has already determined the user parameter
 * names based on the mapping step; if null, then the mapping step will be checked to see if user parameters are available
 * @returns {string} stringified XML, with one m:param element per parameter
 */
function makeParameterElements(mappingStep, userParameterNames) {
  let elements = '<m:param name="URI"/>';
  if (userParameterNames) {
    userParameterNames.forEach(param => elements += `<m:param name="${param}"/>`);
  } else {
    const modulePath = mappingStep.mappingParametersModulePath;
    if (modulePath) {
      if (infoEnabled) {
        hubUtils.hubTrace(infoEvent, `Applying mapping parameters module at path '${modulePath}`);
      }
      try {
        const userParams = hubUtils.requireFunction(modulePath, "getParameterDefinitions")(mappingStep);
        userParams.forEach(userParam => elements += `<m:param name="${userParam.name}"/>`);
      } catch (error) {
        throw Error(`getParameterDefinitions failed in module '${modulePath}'; cause: ${error.message}`);
      }
    }
  }
  return elements;
}

/*
Every m:entity template that gets created will have a 'name' attribute whose value will be  mapping{index}-{entityName}.
For example, mapping0-Customer for a 'Customer' mapping. 'index' 0 implies the mapping corresponding to the targetEntity.
'index' value  > 0 is generated by related entity mappings.
 */
function generateEntityTemplates(index, mappingObject) {
  const rootEntityTypeTitle = getEntityName(mappingObject.targetEntityType);

  // For the root mapping and for each nested object property (regardless of depth), build an object with a single
  // property of the path of the mapping and a value of the mapping. Each of these will then become an XML m:entity template.
  const rootMapping = {};
  rootMapping[rootEntityTypeTitle] = mappingObject;
  let mappings = [rootMapping];
  mappings = mappings.concat(getObjectPropertyMappings(mappingObject, rootEntityTypeTitle));

  const parentEntity = getTargetEntity(fn.string(mappingObject.targetEntityType));

  // For each mapping, build an m:entity template
  return mappings.map(objectPropertyMapping => {
    const propertyPath = Object.keys(objectPropertyMapping)[0];
    const mapping = objectPropertyMapping[propertyPath];
    if (debugEnabled) {
      hubUtils.hubTrace(debugEvent, `Generating template for propertyPath '${propertyPath}' and entityTypeId '${mapping.targetEntityType}'`);
    }
    let model;
    if (mapping.targetEntityType.startsWith("#/definitions/")) {
      model = parentEntity;
    } else {
      model = getTargetEntity(fn.string(mapping.targetEntityType));
    }
    const template = buildEntityTemplate(mapping, model, propertyPath, index);
    if (debugEnabled) {
      hubUtils.hubTrace(debugEvent, `Generated template: ${template}`);
    }
    return template;
  });
}

/**
 * Returns a string of XML. The XML contains elements in the http://marklogic.com/entity-services/mapping namespace,
 * each of which represents a mapping expression in the given mapping.
 *
 * @param mapping a JSON mapping with a properties array containing mapping expressions
 * @param model the ES model, containing a definitions array of entity types
 * @param propertyPath the path in the entity type for the property being mapped. This is used for nested object
 * properties, where a call-template element must be built that references a template constructed by buildEntityTemplate
 * @return {string}
 */
function buildMapProperties(mapping, model, propertyPath, index) {
  let mapProperties = mapping.properties;
  let propertyLines = [];
  if (debugEnabled) {
    hubUtils.hubTrace(debugEvent, `Building mapping properties for '${mapping.targetEntityType}' with
    '${xdmp.describe(model)}'`);
  }
  let entityName = getEntityName(mapping.targetEntityType);
  if (debugEnabled) {
    hubUtils.hubTrace(debugEvent, `Using entity name: ${entityName}`);
  }
  let entityDefinition = model.definitions[entityName];
  if (debugEnabled) {
    hubUtils.hubTrace(debugEvent, `Using entity definition: ${entityDefinition}`);
  }
  let namespacePrefix = entityDefinition.namespacePrefix ? `${entityDefinition.namespacePrefix}:` : '';
  let entityProperties = entityDefinition.properties;
  for (let prop in mapProperties) {
    if (mapProperties.hasOwnProperty(prop)) {
      if (!entityProperties.hasOwnProperty(prop)) {
        hubUtils.hubTrace(debugEvent, `The property '${prop}' is not defined by the entity model`);
        continue;
      }

      let mapProperty = mapProperties[prop];
      let sourcedFrom = escapeXML(mapProperty.sourcedFrom);
      if (sourcedFrom === null || sourcedFrom === undefined || sourcedFrom === "") {
        continue;
      }

      let dataType = entityProperties[prop].datatype;
      let isArray = false;
      if (dataType === 'array') {
        isArray = true;
        dataType = entityProperties[prop].items.datatype;
      }
      let propTag = namespacePrefix + prop;

      let isInternalMapping = mapProperty.targetEntityType && mapProperty.properties;
      if (isInternalMapping || isArray) {
        let propLine;
        if (isInternalMapping) {
          // The template name will match one of the templates constructed by getObjectPropertyTemplates
          const templateName = propertyPath == "" ? prop : "mapping" + index + "-" + propertyPath + "." + prop;
          propLine = `<${propTag} ${isArray? 'datatype="array"':''}><m:call-template name="${templateName}"/></${propTag}>`;
        } else {
          propLine = `<${propTag} datatype="array" xsi:type="xs:${dataType}"><m:val>.</m:val></${propTag}>`;
        }
        propertyLines.push(`<m:for-each><m:select>${sourcedFrom}</m:select>
            ${propLine}
          </m:for-each>`);
      } else {
        let propLine = `<${propTag} xsi:type="xs:${dataType}"><m:val>${sourcedFrom}</m:val></${propTag}>`;
        // If a property is required but not marked as optional, it will always be added, and then entity validation
        // will not fail because the property exists with an empty string as the value.
        propLine = `<m:optional>${propLine}</m:optional>`;
        propertyLines.push(propLine);
      }
    }
  }
  return propertyLines.join('\n');
}

/**
 * Recursive function that returns a mapping for each property with a targetEntityType, which signifies that it is
 * mapping to an object property. Each of these will need to be converted into an m:entity XML template. The name of
 * each template is guaranteed to be unique by being based on the propertyPath and the title of each object property
 * being mapped. This ensures that we have uniquely-named templates in the XSLT transform that's generated from the
 * XML mapping template.
 *
 * @param mapping
 * @param propertyPath
 * @param objectPropertyMappings
 * @return {*[]}
 */
function getObjectPropertyMappings(mapping, propertyPath, objectPropertyMappings = []) {
  if (debugEnabled) {
    hubUtils.hubTrace(debugEvent, `Getting related mappings for '${xdmp.describe(mapping)}'`);
  }
  if (mapping.properties) {
    Object.keys(mapping.properties).forEach(propertyTitle => {
      const property = mapping.properties[propertyTitle];
      if (property.targetEntityType && property.properties) {
        const propertyMapping = {};
        const nestedPropertyPath = propertyPath == "" ? propertyTitle : propertyPath + "." + propertyTitle;
        propertyMapping[nestedPropertyPath] = property;
        objectPropertyMappings.push(propertyMapping);

        getObjectPropertyMappings(property, nestedPropertyPath, objectPropertyMappings);
      }
    });
  }
  return objectPropertyMappings;
}

function getTargetEntity(targetEntityType) {
  if (!entitiesByTargetType[targetEntityType]) {
    let entityModel = entityLib.findModelForEntityTypeId(targetEntityType);
    if (fn.empty(entityModel)) {
      entityModel = fallbackLegacyEntityLookup(targetEntityType);
    }
    if (entityModel && (entityModel.constructor.name === "Document" || entityModel.constructor.name === "ObjectNode")) {
      entityModel = entityModel.toObject();
    }
    if (!entityModel) {
      throw Error('Could not find target entity type: ' + targetEntityType);
    }
    entitiesByTargetType[targetEntityType] = entityModel;
  }
  return entitiesByTargetType[targetEntityType];
}

function retrieveFunctionImports(mappings = []) {
  const stepAsString = JSON.stringify(mappings);
  let customImports = [];
  let shimURIs = hubUtils.invokeFunction(function() {
    const uris = [];
    const mappingFunctionLibs = cts.search(cts.collectionQuery('http://marklogic.com/entity-services/function-metadata'), ["score-zero", "unfaceted"], 0);
    // filter out imports that aren't used by a mapping step
    for (const mappingFunctionLib of mappingFunctionLibs) {
      const functionNames = mappingFunctionLib.xpath("/m:function-defs/m:function-def/@name ! fn:string(.)", {m: "http://marklogic.com/entity-services/mapping"}).toArray();
      if (functionNames.some(name => stepAsString.includes(name))) {
        uris.push(xdmp.nodeUri(mappingFunctionLib));
      }
    }
    return Sequence.from(uris);
  }, xdmp.databaseName(xdmp.modulesDatabase()));
  for (let uri of shimURIs) {
    customImports.push(`<m:use-functions href="${fn.string(uri)}"/>`);
  }
  return customImports.join('\n');
}

/**
 * Build an "entity template", defined by an entity element in the http://marklogic.com/entity-services/mapping
 * namespace, for the given property mapping.
 *
 * @param mapping
 * @param model
 * @param propertyPath the path in the entity type for the property being mapped. This is used as the name of the
 * entity template, and thus it will also be used in call-template references to this template.
 *
 * @return {string}
 */
function buildEntityTemplate(mapping, model, propertyPath, index) {
  let entityName = getEntityName(mapping.targetEntityType);
  let entityDefinition = model.definitions[entityName];
  if (!entityDefinition) {
    throw Error(`Could not find an entity type with name: ${entityName}`);
  }
  let namespacePrefix = entityDefinition.namespacePrefix;
  let entityTag = namespacePrefix ? `${namespacePrefix}:${entityName}`: entityName;
  let namespaceNode = `xmlns${namespacePrefix ? `:${namespacePrefix}`: ''}="${entityDefinition.namespace || ''}"`;
  return `
      <m:entity name="mapping${index}-${propertyPath}" xmlns:m="http://marklogic.com/entity-services/mapping">
        <${entityTag} ${namespaceNode} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          ${buildMapProperties(mapping, model, propertyPath, index)}
        </${entityTag}>
      </m:entity>`;
}

function getEntityName(targetEntityType) {
  return fn.head(fn.reverse(fn.tokenize(targetEntityType, '/')));
}

function fallbackLegacyEntityLookup(targetEntityType) {
  let targetArr = String(targetEntityType).split('/');
  let entityName = targetArr[targetArr.length - 1];
  let tVersion = targetArr[targetArr.length - 2] ? targetArr[targetArr.length - 2].split('-') : '';
  let modelVersion = tVersion[tVersion.length - 1];
  return fn.head(mappingStepLib.getModel(entityName, modelVersion));
}

function escapeXML(input = '') {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;');
}

/**
 * Main purpose of this function is for testing a mapping against a persisted document, identified by the uri parameter.
 * This is not used when a mapping step is run; this functionality is independent of flows/steps, and should really be moved
 * into a mapping-specific library that is not under "steps".
 *
 * @param mapping
 * @param uri
 * @returns
 */
function validateAndTestMapping(mapping, uri) {
  if (!fn.docAvailable(uri)) {
    throw Error(`Unable to validate and run mapping; could not find source document with URI '${uri}'`);
  }

  let sourceDocument;
  //modify the document instance with the properly updated one if a pre-step interceptor was used
  let newDocumentIsLoad = false;
  if (mapping.name) {
    let docActual = cts.doc(uri);
    const updatedDocument = invokeGetDocument(mapping.name, uri);
    sourceDocument = docActual.toObject();
    if (updatedDocument && updatedDocument.format === "JSON") {
      if (sourceDocument) {
        sourceDocument = updatedDocument.data;
        sourceDocument = xdmp.toJSON(sourceDocument);
        newDocumentIsLoad = true;
      }
    } else if (updatedDocument && updatedDocument.format === "XML") {
      const updatedData = updatedDocument.data;
      sourceDocument = updatedData;
      newDocumentIsLoad = true;
    }
  }
  if (!newDocumentIsLoad) {
    sourceDocument = cts.doc(uri);
  }

  const modulePath = mapping.mappingParametersModulePath;
  let userParameterNames = [];
  let userParameterMap = {};
  try {
    if (modulePath) {
      const contentSequence = Sequence.from([{"uri": uri, "value": sourceDocument}]);
      userParameterNames = hubUtils.requireFunction(modulePath, "getParameterDefinitions")(mapping).map(def => def.name);
      userParameterMap = hubUtils.requireFunction(modulePath, "getParameterValues")(contentSequence);
    }
  } catch (error) {
    // Need to throw an HTTP error so that the testMapping endpoint returns a proper error
    httpUtils.throwBadRequest(`Unable to apply mapping parameters module at path '${modulePath}'; cause: ${error.message}`);
  }

  const parameterMap = Object.assign({}, {"URI": uri}, userParameterMap);
  const sourceInstance = getSourceRecordForMapping(mapping, sourceDocument);
  const mappingsArray = createMappingsArray(mapping);
  const validatedMappingsArray = validateMappings(mappingsArray, userParameterNames);
  let validatedAndTestedMapping =  testMappings(mapping, validatedMappingsArray, sourceInstance, userParameterNames, parameterMap);
  let validatedAndTestedMappingWithUri = validateAndTestUriExpressions(validatedAndTestedMapping, validatedMappingsArray, sourceInstance, userParameterNames, parameterMap);
  return validatedMappingsArray.length > 1 ? calculateInstanceCount(validatedAndTestedMappingWithUri, validatedMappingsArray, sourceInstance) : validatedAndTestedMappingWithUri;
}



function invokeGetDocument(stepName, uri) {
  return fn.head(xdmp.invoke(
    "/data-hub/data-services/mapping/getDocument.mjs",
    {stepName: stepName, uri: uri, keepSameType: true}
  ));
}

function validateMappings(mappingsArray, userParameterNames) {
  const validatedMappingsArray = mappingsArray.map(mappingToTest => {
    return validateMapping(mappingToTest, userParameterNames);
  });
  return validatedMappingsArray;
}

function createMappingsArray(mapping) {
  const mappingCount = 1 + (mapping.relatedEntityMappings ? mapping.relatedEntityMappings.length : 0);
  let mappingsArray = [];
  mapping.uriExpression = mapping.uriExpression ? mapping.uriExpression : "$URI";
  mapping.expressionContext = mapping.expressionContext ? mapping.expressionContext : "/";
  mappingsArray.push(mapping);

  if (mapping.relatedEntityMappings) {
    for (let i=0; i < mappingCount-1 ; i++) {
      const relatedEntityMapping = mapping.relatedEntityMappings[i];
      relatedEntityMapping.namespaces = mapping.namespaces;
      relatedEntityMapping.uriExpression = relatedEntityMapping.uriExpression ? relatedEntityMapping.uriExpression : "hubURI('" + getEntityName(relatedEntityMapping.targetEntityType) + "')";
      relatedEntityMapping.expressionContext = relatedEntityMapping.expressionContext ? relatedEntityMapping.expressionContext : "/";
      mappingsArray.push(relatedEntityMapping);
    }
  }
  return mappingsArray;
}

function testMappings(mapping, validatedMappingsArray, sourceInstance, userParameterNames, parameterMap) {
  for (let i =0 ; i < validatedMappingsArray.length; i++) {
    const response = testMapping(validatedMappingsArray[i], sourceInstance, userParameterNames, parameterMap);
    if (i ==0) {
      mapping.properties = response.properties;
    } else {
      mapping.relatedEntityMappings[i-1] = response;
    }
  }
  return mapping;
}

function validateAndTestUriExpressions(mapping, validatedMappingsArray, sourceInstance, userParameterNames, parameterMap) {
  const namespaces = fetchNamespacesFromMappingStep(mapping);
  const functionImports = retrieveFunctionImports(createMappingsArray(mapping));
  const mappingParameters = makeParameterElements(mapping, userParameterNames);
  let uriExpressionList = [];
  validatedMappingsArray.forEach((entityMapping, mappingIndex) => {
    const xmlMapping = xdmp.unquote(`
    <m:mapping xmlns:m="http://marklogic.com/entity-services/mapping" xmlns:instance="http://marklogic.com/datahub/entityInstance" xmlns:map="http://marklogic.com/xdmp/map" ${namespaces.join(' ')}>
      ${functionImports}
      ${mappingParameters}
        <m:entity name="uriMapping">
          <uri>
            <m:val>${entityMapping.uriExpression}</m:val>
          </uri>
        </m:entity>
        <m:output>
          <uris>
            <m:for-each>
                <m:select>${entityMapping.expressionContext}</m:select>
                <m:call-template name="uriMapping"/>
            </m:for-each>
          </uris>
        </m:output>
    </m:mapping>`);
    let response;
    let errorEvaluatingExpression = false;
    try {
      validateXmlMapping(xmlMapping);
    } catch (e) {
      response = hubUtils.getErrorMessage(e);
      errorEvaluatingExpression = true;
    }
    try {
      if (!response) {
        if (uriExpressionList.includes(entityMapping.uriExpression)) {
          response = "Mapping expression returns a duplicate Uniform Resource Identifier (URI). URIs must be unique to each entity.";
          errorEvaluatingExpression = true;
        } else {
          uriExpressionList.push(entityMapping.uriExpression);
          const uriString = String(fn.head(testXmlMapping(xmlMapping, sourceInstance, parameterMap)).xpath('*:uris/*:uri[1]/text()'));
          response = flowUtils.properExtensionURI(uriString, fn.lowerCase(mapping.targetFormat));
        }
      }
    } catch (e) {
      response = hubUtils.getErrorMessage(e);
      errorEvaluatingExpression = true;
    }
    if (!errorEvaluatingExpression && !response) {
      errorEvaluatingExpression = true;
      response = "The Context or URI expression is inapplicable to the respective source document and will lead to null outputs for the remaining fields below.";
    }

    if (mappingIndex == 0) {
      mapping.uriExpression = {};
      if (errorEvaluatingExpression) {
        mapping.uriExpression.errorMessage = response;
      } else {
        mapping.uriExpression.output = response;
      }
    } else {
      mapping.relatedEntityMappings[mappingIndex - 1].uriExpression = {};
      if (errorEvaluatingExpression) {
        mapping.relatedEntityMappings[mappingIndex - 1].uriExpression.errorMessage = response;
      } else {
        mapping.relatedEntityMappings[mappingIndex - 1].uriExpression.output = response;
      }
    }
  });
  return mapping;
}

function calculateInstanceCount(mapping, validatedMappingsArray, sourceInstance) {
  const namespaces = getMappingNamespacesObject(mapping);
  const sourceDocument = fn.head(xdmp.unquote(xdmp.quote(sourceInstance)));
  validatedMappingsArray.forEach((entityMapping, mappingIndex) => {
    if (mappingIndex != 0) {
      const instanceCount = fn.count(sourceDocument.xpath(entityMapping.expressionContext, namespaces));
      if (instanceCount > 1) {
        mapping.relatedEntityMappings[mappingIndex - 1].expressionContext = {};
        mapping.relatedEntityMappings[mappingIndex - 1].expressionContext.output = `${instanceCount} instances (1 shown)`;
      }
    }
  });
  return mapping;
}

/**
 * Validates all property mappings in the given mapping object. For any invalid mapping expression, the object representing that expression is given an "errorMessage" property that
 * captures the validation error.
 *
 * @param mapping
 * @param {array} userParameterNames
 * @return {{targetEntityType: *, properties: {}}}
 */
function validateMapping(mapping, userParameterNames) {
  // Rebuild the mapping without its "properties"
  // Those will be rebuilt next, but with each property mapping validated
  let validatedMapping = {};
  Object.keys(mapping).forEach(key => {
    if (key != "properties") {
      validatedMapping[key] = mapping[key];
    }
  });
  validatedMapping.properties = {};

  Object.keys(mapping.properties || {}).forEach(propertyName => {
    let mappedProperty = mapping.properties[propertyName];

    // If this is a nested property, validate its child properties first
    if (mappedProperty.hasOwnProperty("targetEntityType")) {
      if (mappedProperty.targetEntityType.startsWith('#/definitions/')) {
        const definitionName = mappedProperty.targetEntityType.substring(mappedProperty.targetEntityType.lastIndexOf('/') + 1);
        const fullTargetEntity = mapping.targetEntityType.substring(0, mapping.targetEntityType.lastIndexOf('/') + 1) + definitionName;
        mappedProperty.targetEntityType = fullTargetEntity;
      }
      mappedProperty.namespaces = mapping.namespaces;
      mappedProperty.expressionContext = mapping.expressionContext;
      mappedProperty = validateMapping(mappedProperty, userParameterNames);
    }

    // Validate the mapping expression, and if an error occurs, add it to the mapped property object
    let sourcedFrom = mappedProperty.sourcedFrom;
    let errorMessage = validatePropertyMapping(mapping, userParameterNames, propertyName, sourcedFrom);
    if (errorMessage != null) {
      mappedProperty.errorMessage = errorMessage;
    }

    validatedMapping.properties[propertyName] = mappedProperty;
  });

  return validatedMapping;
}

/**
 * Validate a single property mapping by constructing a mapping consisting of just the given property mapping.
 *
 * @param fullMapping
 * @param {array} userParameterNames
 * @param propertyName
 * @param sourcedFrom
 * @return an error message if the mapping validation fails
 */
function validatePropertyMapping(fullMapping, userParameterNames, propertyName, sourcedFrom) {
  let mapping = {
    "namespaces": fullMapping.namespaces,
    "targetEntityType": fullMapping.targetEntityType,
    "expressionContext": fullMapping.expressionContext,
    "properties": {}
  };

  mapping.properties[propertyName] = {
    "sourcedFrom": sourcedFrom
  };

  try {
    const xmlMapping = buildMappingXML(mapping, userParameterNames);
    // As of trunk 10.0-20190916, mappings are being validated against entity schemas in the schema database.
    // This doesn't seem expected, as the validation will almost always fail.
    // Thus, this is not using es.mappingCompile, which does validation, and just invokes the transform instead.
    validateXmlMapping(xmlMapping);
  } catch (e) {
    return mappingLib.extractErrorMessageForMappingUI(e);
  }
}

function validateXmlMapping(xmlMapping) {
  let stylesheet = fn.head(xdmp.xsltInvoke("/MarkLogic/entity-services/mapping-compile.xsl", xmlMapping));
  xdmp.xsltEval(stylesheet, [], {staticCheck: true});
}

/**
 * Tests the given mapping against the given source instance by returning the mapping with
 * each mapping expression containing an "output" property or an "errorMessage" property.
 * This is not used when running a mapping step; it's only used when testing a mapping.
 *
 * @param {object} mapping The mapping step
 * @param {document} sourceInstance the instance to be mapped; assumed to have been extracted from a source document
 * @param {array} userParameterNames
 * @param {object} parameterMap
 * @param propMapping
 * @param paths
 * @returns
 */
function testMapping(mapping, sourceInstance, userParameterNames, parameterMap,
  propMapping={"targetEntityType": mapping.targetEntityType, "expressionContext": mapping.expressionContext, "namespaces": mapping.namespaces, "properties": {}}, paths=['properties']) {
  Object.keys(mapping.properties || {}).forEach(propertyName => {
    let mappedProperty = mapping.properties[propertyName];
    let sourcedFrom = escapeXML(mappedProperty.sourcedFrom);
    paths.push(propertyName);
    //Don't run mapping if the property is unset (sourcedFrom.length==0) or if the validation returns errors
    if (!mappedProperty.errorMessage && sourcedFrom.length > 0) {
      propMapping.expressionContext = mapping.expressionContext;
      if (mappedProperty.hasOwnProperty("targetEntityType")) {
        propMapping = addNode(propMapping, paths, mappedProperty, true);
        paths.push("properties");
        mappedProperty = testMapping(mappedProperty, sourceInstance, userParameterNames, parameterMap, propMapping, paths);
        paths.pop();
      } else {
        propMapping = addNode(propMapping, paths, mappedProperty,  false);
      }
    }
    if (mappedProperty && !mappedProperty.errorMessage && ! mappedProperty.hasOwnProperty("targetEntityType") && sourcedFrom.length > 0) {
      let resp = testMappingExpression(propMapping, propertyName, sourceInstance, userParameterNames, parameterMap);
      if (resp && resp.output) {
        mappedProperty["output"] = resp.output;
      } else {
        mappedProperty["errorMessage"] = resp.errorMessage;
      }
    }

    let propertiesPath = paths.map((p) => { return '["' +p + '"]'; });
    eval(`delete propMapping${propertiesPath.join("")}`) ;
    paths.pop();
  });
  return mapping;
}

/**
 * Tests the given mapping against the given source document, only executing the mapping
 * expression associated with the given property name.
 *
 * @param mapping
 * @param propertyName
 * @param sourceInstance
 * @param {array} userParameterNames
 * @param {object} parameterMap
 * @returns
 */
// TODO Figure out relevancy of this comment
//es.nodeMapToCanonical can be used after server bug #53497 is fixed
function testMappingExpression(mapping, propertyName, sourceInstance, userParameterNames, parameterMap) {
  let resp = {};
  const xmlMapping = buildMappingXML(mapping, userParameterNames);

  try {
    /*
    Running the xslt will return an xml doc which looks like
    <instance:mapping0Instances>
    <instance:entityInstance>
    <value>
    <entityName>
    ....
    </entityName>
    </value>
    </instance:entityInstance>
    </instance:mapping0Instances>. The xpath extracts only the first instance, will be modified in later when UI supports
    multiple instances
     */

    let outputDoc = inst.canonicalJson(xdmp.unquote(xdmp.quote(fn.head(testXmlMapping(xmlMapping, sourceInstance, parameterMap)).xpath('/instance:mapping0Instances/instance:entityInstance[1]/*:value/node()', {"instance": "http://marklogic.com/datahub/entityInstance"}))));
    let output = outputDoc.xpath("//" + propertyName);
    let arr = output.toArray();
    if (arr.length <= 1) {
      resp.output = String(fn.head(output));
    } else {
      resp.output = arr.map(String);
    }
  } catch (e) {
    resp.errorMessage = mappingLib.extractErrorMessageForMappingUI(e);
  }
  return resp;
}

function testXmlMapping(xmlMapping, sourceInstance, parameterMap) {
  let mappingXslt = xdmp.invokeFunction(function () {
    const es = require('/MarkLogic/entity-services/entity-services');
    return es.mappingCompile(xmlMapping);
  }, {database: xdmp.modulesDatabase()});

  let inputDoc = sourceInstance;
  if (!(hubUtils.isDocumentNode(inputDoc))) {
    inputDoc = fn.head(xdmp.unquote(String(sourceInstance)));
  }
  return xdmp.xsltEval(mappingXslt, inputDoc, parameterMap);
}

function addNode(obj, paths, mappedProperty, isNested) {
  let res=obj;
  const namespaces = res.namespaces;
  for (let i=0;i<paths.length -1;i++) {
    obj=obj[paths[i]];
  }
  if (isNested) {
    obj[paths[paths.length -1]] = {"targetEntityType": mappedProperty.targetEntityType, namespaces, "sourcedFrom": mappedProperty.sourcedFrom, "properties": {}};
  } else {
    obj[paths[paths.length -1]] = {"sourcedFrom": mappedProperty.sourcedFrom};
  }
  return res;
}

function extractInstance(docNode) {
  let instance = docNode.xpath('/*:envelope/(object-node("instance")|*:instance/(element() except *:info))');
  if (fn.empty(instance)) {
    instance = docNode;
  } else if (fn.count(instance) > 1) {
    // can't use node builder here as it won't allow multiple root nodes
    instance = fn.head(getXQueryLib().documentWithNodes(instance));
  }
  return fn.head(instance);
}

function getXQueryLib() {
  if (!xqueryLib) {
    xqueryLib = require('/data-hub/5/builtins/steps/mapping/entity-services/xquery-lib.xqy');
  }
  return xqueryLib;
}

function getMarkLogicMappingFunctions() {
  return fn.head(hubUtils.invokeFunction(function() {
    let fnMetadata = fn.collection("http://marklogic.com/entity-services/function-metadata");
    let ns = {"m": "http://marklogic.com/entity-services/mapping"};
    const functionMap = new Map();
    let output = [];

    for (const metaData of fnMetadata) {
      const functionDefs = fn.head(metaData.xpath("/m:function-defs", ns));
      if (fn.exists(functionDefs)) {
        let fnLocation = functionDefs.xpath("./@location", ns);
        for (const mlFunction of functionDefs.xpath("./m:function-def", ns)) {
          let funcName = String(mlFunction.xpath("./@name", ns));
          let params = String(mlFunction.xpath("./m:parameters/m:parameter/@name", ns)).replace("\n", ",");

          let singleFunction ={};
          singleFunction["functionName"] = funcName;
          singleFunction["signature"] = funcName +"("+params+")";
          singleFunction["category"] = (String(fnLocation).includes("/data-hub/5/mapping-functions")) ? "builtin" : "custom";
          functionMap.set(funcName, singleFunction);
        }
      }
    }
    for (let value of functionMap.values()) {
      output.push(value);
    }
    return output;
  }, config.MODULESDATABASE));
}

function getXpathMappingFunctions() {
  const xpathFunctions = getXQueryLib().detectFunctions().toObject();
  return getFunctionsWithSignatures(xpathFunctions);
}

function getFunctionsWithSignatures(xpathFunctions) {
  const excludedFunctions = getXpathFunctionsThatDoNotWorkInMappingExpressions();
  const response = [];
  //used to prevent duplicates(overloaded functions) in the response
  const functionMap = new Map();
  for (let xpathFunctionItem of xpathFunctions) {
    let xpathFunction = Object.assign({}, xpathFunctionItem);
    let fn = xpathFunction.functionName;
    if (!excludedFunctions.includes(fn)) {
      xpathFunction["category"] = "xpath";
      functionMap.set(fn, xpathFunction);
    }
  }
  for (let value of functionMap.values()) {
    response.push(value);
  }
  return response;
}

/**
 * Per DHFPROD-5084, these have been identified as functions that do not work in mapping expressions. See the unit
 * test for this function to see how they have been identified.
 * @returns {string[]}
 */
function getXpathFunctionsThatDoNotWorkInMappingExpressions() {
  return [
    "index-of",
    "base-uri",
    "document-uri",
    "node-uri",
    "filtered",
    "unparsed-text",
    "nilled",
    "unparsed-text-available",
    "in-scope-prefixes",
    "collection",
    "type-available",
    "error",
    "default-collation",
    "static-base-uri",
    "doc"
  ];
}

function getSourceRecordForMapping(mappingStep, sourceRecord) {
  const sourceRecordInstanceOnly = mappingStep.sourceRecordScope == "entireRecord" ? false : true;
  return sourceRecordInstanceOnly ? extractInstance(sourceRecord) : sourceRecord;
}

export default {
  xsltPermissions,
  xmlMappingCollections,
  buildMappingXML,
  buildEntityTemplate,
  extractInstance,
  getEntityName,
  getFunctionsWithSignatures,
  getMarkLogicMappingFunctions,
  getSourceRecordForMapping,
  getTargetEntity,
  getXpathFunctionsThatDoNotWorkInMappingExpressions,
  getXpathMappingFunctions,
  // Exporting retrieveFunctionImports for unit test
  retrieveFunctionImports,
  validateMapping,
  validateAndTestMapping
};
