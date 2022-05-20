import React, {useState, useEffect, useContext} from "react";
import {Alert, Modal} from "react-bootstrap";
import Select, {components as SelectComponents} from "react-select";
import reactSelectThemeConfig from "@config/react-select-theme.config";
import styles from "./entity-type-display-settings-modal.module.scss";
import {EntityTypeColorPicker, HCTable, HCButton, HCTooltip, HCIconPicker, HCPopoverSearch} from "@components/common";
import {QuestionCircleFill} from "react-bootstrap-icons";
import tooltipsConfig from "@config/explorer-tooltips.config";
import {themeColors} from "@config/themes.config";
import {defaultIcon} from "@config/explore.config";
import {UserContext} from "@util/user-context";
import {HubCentralConfigContext} from "@util/hubCentralConfig-context";
import Highlighter from "react-highlight-words";
import * as _ from "lodash";
// ToDo: For use in DHFPROD-8869: Modify Explore Settings to Change hover properties (Structured properties only)
// import EntityPropertyTreeSelect from "../../entity-property-tree-select/entity-property-tree-select";
// import axios from "axios";
// import {definitionsParser} from "@util/data-conversion";
// import {Definition} from "../../../types/modeling-types";

type Props = {
  isVisible: boolean;
  toggleModal: (reloadData: boolean) => void;
  entityDefinitionsArray: any;
};
// ToDo: For use in DHFPROD-8869: Modify Explore Settings to Change hover properties (Structured properties only)
// const DEFAULT_ENTITY_DEFINITION: Definition = {
//   name: "",
//   properties: []
// };

enum TableColumns {
  EntityType,
  Color,
  Icon,
  EntityLabel,
  PropertiesOnHover
}

const {entityTypeDisplaySettings} = tooltipsConfig;

const EntityTypeDisplaySettingsModal: React.FC<Props> = ({isVisible, toggleModal, entityDefinitionsArray}) => {
  const {handleError} = useContext(UserContext);
  const [entitiesData, setEntitiesData] = useState({});
  const [entitiesIndexes, setEntitiesIndexes] = useState({});
  const [exploreSettingsData, setExploreSettingsData] = useState<any[]>([]);
  const [filteredSettingsData, setFilteredSettingsData] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");

  const {hubCentralConfig, updateHubCentralConfigOnServer} = useContext(HubCentralConfigContext);

  useEffect(() => {
    if (isVisible && hubCentralConfig && hubCentralConfig?.modeling?.entities) {
      let tmpEntitiesData = _.clone(hubCentralConfig?.modeling?.entities);
      let tmpEntitiesIndexes = {};
      let settingsData:any = Object.keys(hubCentralConfig?.modeling?.entities).map((entityType, index) => {
        tmpEntitiesIndexes[entityType] = index;
        return {
          entityType: entityType,
          color: hubCentralConfig?.modeling?.entities[entityType]?.color || themeColors.defaults.entityColor,
          icon: hubCentralConfig?.modeling?.entities[entityType]?.icon || defaultIcon,
          label: hubCentralConfig?.modeling?.entities[entityType]?.label,
          propertiesOnHover: hubCentralConfig?.modeling?.entities[entityType]?.propertiesOnHover
        };
      });
      setEntitiesData(tmpEntitiesData);
      setEntitiesIndexes(tmpEntitiesIndexes);
      setExploreSettingsData(settingsData);
    }

    return () => {
      setEntitiesData({});
      setEntitiesIndexes({});
      setExploreSettingsData([]);
      setFilteredSettingsData([]);
    };
  }, [isVisible, hubCentralConfig]);

  useEffect(() => {
    setFilteredSettingsData(prev => {
      return exploreSettingsData
        .filter(entityTypeObject => entityTypeObject.entityType.toLowerCase().includes(searchText.toLowerCase()))
        .map((entityTypeObject) => ({...entityTypeObject, searchText}));
    });
  }, [exploreSettingsData, searchText]);

  // ToDo: For use in DHFPROD-8869: Modify Explore Settings to Change hover properties (Structured properties only)
  // useEffect(() => {
  //   getEntityModels();
  // }, []);
  // const [entityModels, setEntityModels] = useState<any>({});
  // const getEntityModels = async () => {
  //   try {
  //     let response = await axios.get(`/api/models/primaryEntityTypes`);
  //     if (response.status === 200) {
  //       let models:any = {};
  //       response.data.forEach(model => {
  //         // model has an entityTypeId property, perhaps that should be used instead of entityName?
  //         models[model.entityName] = model;
  //       });
  //       setEntityModels({...models});
  //     }
  //   } catch (error) {
  //     console.error("Error fetching entities", error);
  //     handleError(error);
  //   }
  // };

  const closeModal = () => {
    toggleModal(false);
  };

  const columnSorter = (a: any, b: any, order: string) => order === "asc" ? a.localeCompare(b) : b.localeCompare(a);

  const renderOptions = (entityType, includeStructured: boolean = false) => {
    let entityTypeDef:any = entityDefinitionsArray.find(entity => entity.name === entityType);
    const options:any = entityTypeDef?.properties?.filter(property => includeStructured || property.ref === "").map(item => ({value: item?.name, label: item?.name}));
    return options;
  };

  const onColumnValueChange = (row, e, column: TableColumns) => {
    const updateValue = (entityData) => {
      switch (column) {
      case TableColumns.Color:
        entityData.color = e.color.hex;
        break;
      case TableColumns.Icon:
        entityData.icon = e;
        break;
      case TableColumns.EntityLabel:
        entityData.label = e.value;
        break;
      case TableColumns.PropertiesOnHover:
        entityData.propertiesOnHover = e.map(option => option.value);
        // ToDo: For use in DHFPROD-8869: Modify Explore Settings to Change hover properties (Structured properties only)
        // entityData.propertiesOnHover = [e];
        break;
      }
    };

    setEntitiesData(entitiesData => {
      const tmpEntitiesData = _.cloneDeep(entitiesData);
      updateValue(tmpEntitiesData[row.entityType]);
      return tmpEntitiesData;
    });

    setExploreSettingsData(exploreSettingsData => {
      const settingsData = exploreSettingsData.map(entityData => Object.assign({}, entityData));
      updateValue(settingsData[entitiesIndexes[row.entityType]]);
      return settingsData;
    });
  };

  const getHeaderLabel = (label, tooltipInfo) => {
    let headerLabel = <span className={styles.labelContainer}>
      <span className={styles.headerLabel}>{label}</span>
      <HCTooltip id="entity-label" text={tooltipInfo} placement="right">
        <QuestionCircleFill aria-label="icon: question-circle" color={themeColors.defaults.questionCircle} size={13} className={styles.infoIcon} />
      </HCTooltip>
    </span>;

    return headerLabel;
  };

  const handleSave = () => {
    try {
      let updatedPayload = _.cloneDeep(hubCentralConfig);
      updatedPayload.modeling.entities = Object.assign({}, entitiesData);
      updateHubCentralConfigOnServer(updatedPayload);
      closeModal();
    } catch (error) {
      if (error.response.status === 400) {
        if (error.response.data.hasOwnProperty("message")) {
          setErrorMessage("name-error");
        } else {
          setErrorMessage(error["response"]["data"]["message"]);
        }
      } else {
        handleError(error);
      }
    }
  };

  const MenuList  = (selector, props) => (
    <div id={`${selector}-select-MenuList`}>
      <SelectComponents.MenuList {...props} />
    </div>
  );

  const exploreSettingsColumns: any = [
    {
      text: <span className={styles.labelContainer}>
        <span className={styles.headerLabel}>Entity Type</span>
        <span className="position-absolute end-0 me-3">
          <HCPopoverSearch
            inputValue={searchText}
            onSearch={(value) => {
              setSearchText(value);
            }}
            onReset={() => {
              setSearchText("");
            }}
          />
        </span>
      </span>,
      dataField: "entityType",
      headerClassName: "position-relative",
      sort: true,
      width: "20%",
      sortFunc: columnSorter,
      formatter: (text, row) => {
        return (<span aria-label={`${row.entityType}-entityType`}>
          <Highlighter
            highlightClassName={styles.highlightStyle}
            searchWords={[row.searchText]}
            autoEscape
            textToHighlight={row.entityType}
          />
        </span>);
      }
    },
    {
      text: getHeaderLabel("Color", entityTypeDisplaySettings.color),
      width: "10%",
      align: "center" as "center",
      headerAlign: "center",
      formatter: (text, row) => {
        return <EntityTypeColorPicker color={row.color} entityType={row.entityType} handleColorChange={(color, event) => onColumnValueChange(row, {color, event}, TableColumns.Color)} />;
      }
    },
    {
      text: getHeaderLabel("Icon", entityTypeDisplaySettings.icon),
      width: "10%",
      align: "center" as "center",
      headerAlign: "center",
      formatter: (text, row) => {
        return (<div className={"m-auto d-inline-block"} aria-label={`${row.entityType}-icon-picker`} id={`${row.entityType}-icon-picker`} data-icon={row.icon}>
          <HCIconPicker value={row.icon} onChange={value => onColumnValueChange(row, value, TableColumns.Icon)}/>
        </div>);
      }
    },
    {
      text: getHeaderLabel("Record Label", entityTypeDisplaySettings.entityLabel),
      width: "25%",
      formatter: (text, row) => {
        return (
          <Select
            id={`${row.entityType}-entityLabel-select-wrapper`}
            inputId={`${row.entityType}-entityLabel-select`}
            components={{MenuList: props => MenuList(`${row.entityType}-entityLabel`, props)}}
            defaultValue={row.label ? {label: row.label, value: row.label} : null}
            value={row.label ? {label: row.label, value: row.label} : null}
            options={renderOptions(row.entityType)}
            onChange={(e) => onColumnValueChange(row, e, TableColumns.EntityLabel)}
            classNamePrefix="select"
            aria-label={`${row.entityType}-label-select-dropdown`}
            formatOptionLabel={({value, label}) => {
              return (
                <span data-testid={`${row.entityType}-labelOption-${value}`} aria-label={`${row.entityType}-labelOption-${value}`}>
                  {label}
                </span>
              );
            }}
            styles={reactSelectThemeConfig}
          />);
      },
    },
    {
      text: getHeaderLabel("Properties on Hover", entityTypeDisplaySettings.propertiesOnHover),
      width: "35%",
      formatter: (text, row) => {
        return (
          <Select
            id={`${row.entityType}-entityProperties-select-wrapper`}
            inputId={`${row.entityType}-entityProperties-select`}
            components={{MenuList: props => MenuList(`${row.entityType}-entityProperties`, props)}}
            defaultValue={row.propertiesOnHover?.map(property => ({value: property, label: property}))}
            value={row.propertiesOnHover?.map(property => ({value: property, label: property}))}
            isMulti
            options={renderOptions(row.entityType, true)}
            classNamePrefix="select"
            aria-label={`${row.entityType}-propertiesOnHover`}
            onChange={(e) => onColumnValueChange(row, e, TableColumns.PropertiesOnHover)}
            formatOptionLabel={({value, label}) => {
              return (
                <span data-testid={`${row.entityType}-propertiesOption-${value}`} aria-label={`${row.entityType}-propertiesOption-${value}`}>
                  {label}
                </span>
              );
            }}
            styles={reactSelectThemeConfig}
          />
        );
        // ToDo: For use in DHFPROD-8869: Modify Explore Settings to Change hover properties (Structured properties only)
        // let definitions: any[] = [];
        // if (entityModels[row.entityType]?.model.definitions) {
        //   definitions = definitionsParser(entityModels[row.entityType]?.model.definitions);
        // }
        // let entityTypeDefinition: Definition = definitions.find(entityDefinition => entityDefinition.name === row.entityType) || DEFAULT_ENTITY_DEFINITION;
        // return (
        //   <EntityPropertyTreeSelect
        //     isForMerge={true}
        //     propertyDropdownOptions={entityTypeDefinition.properties}
        //     entityDefinitionsArray={definitions}
        //     value={row.propertiesOnHover?.length ? row.propertiesOnHover[0] : undefined}
        //     onValueSelected={(value) => {
        //       onColumnValueChange(row, value, TableColumns.PropertiesOnHover);
        //     }}
        //   />
        // );
      }
    }
  ];

  const modalFooter = (
    <div className={styles.editFooter}>
      <div
        className={styles.footer}
      >
        <HCButton
          size="sm"
          variant="outline-light"
          id={`cancel-entityType-settings-modal`}
          aria-label={`cancel-entityType-settings-modal`}
          onClick={() => closeModal()}
        >Cancel</HCButton>
        <HCButton
          className={styles.saveButton}
          size="sm"
          id={`save-entityType-settings-modal`}
          aria-label={`save-entityType-settings-modal`}
          variant="primary"
          onClick={handleSave}
        >Save</HCButton>
      </div>
    </div>
  );

  return (
    <Modal
      show={isVisible}
      dialogClassName={styles.modal1400w}
    >
      <Modal.Header className={"bb-none align-items-start"}>
        <span className={"fs-4"}>
          Entity Display Settings
        </span>
        <button type="button" className="btn-close" aria-label="Close" id={"close-settings-modal"} onClick={() => closeModal()}></button>
      </Modal.Header>
      <Modal.Body>
        {errorMessage &&
          <Alert variant="danger" className="alert">
            {errorMessage}
          </Alert>
        }
        <div id="entityTypeDisplaySettingsContainer" data-testid="entityTypeDisplaySettingsContainer">
          <HCTable
            rowKey="entityType"
            className={styles.table}
            columns={exploreSettingsColumns}
            data={filteredSettingsData}
          />
        </div>
        {modalFooter}
      </Modal.Body>
    </Modal>
  );
};

export default EntityTypeDisplaySettingsModal;