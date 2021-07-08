import React, { useState, useEffect } from "react";
import Graph from "react-graph-vis";
import cloneDeep from "lodash/cloneDeep";
import "./graph-vis.scss";

type Props = {
    entityTypes: any;
    mode: string;
};

const defaultNodeProps: any = {
  shape: "box",
  shapeProperties: {
    borderRadius: 2
  },
  icon: {
    face: '"Font Awesome 5 Free"',
    code: "\f82f",
    size: 50,
    color: "#f0a30a",
  },
  font: {
    multi: true,
    align: "left",
    bold: {
      color: "#6773af",
      vadjust: 3,
      size: 12
    },
  },
  margin: 10,
  widthConstraint: {
    minimum: 80
  },
};

const GraphVis: React.FC<Props> = (props) => {

  const [nodePositions, setNodePositions] = useState({});
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  
  //Initializing network instance
  const [network, setNetwork] = useState<any>(null);
  const initNetworkInstance = (networkInstance) => {
    setNetwork(networkInstance)
  }

  // Initialize graph after async loading of entity data
  useEffect(() => {
    setGraphData({
      nodes: getNodes(),
      edges: getEdges()
    });
  }, [props.entityTypes]);

  //Use these to set specific positions for entity nodes temporarily
  let nodeP = {
      BabyRegistry: {
          x: 134.5, y: -165
      },
      Customer: {
          x: -1.8683534551792256, y: -13.817459136071609
      },
      Product: {
          x: -290.5, y: -57
      },
      Order: {
          x: 311.5, y: 1
      },
      NamespacedCustomer: {
          x: -193.56170318899566, y: 27.318452823974837
      },
      Person: {
          x: -143.5, y: -143
      }
  }

  let entityMetadata = {
    BabyRegistry: {
      color: "#e3ebbc",
      instances: 5
    },
    Customer: {
      color: "#ecf7fd",
      instances: 63
    },
    Product: {
      color: "#ded2da",
      instances: 252
    },
    Order: {
      color: "#cfe3e8",
      instances: 50123
    },
    NamespacedCustomer: {
      color: "#dfe2ec",
      instances: 75
    },
    Person: {
      color: "#dfe2ec",
      instances: 75
    }
  };

  const colors = ["#e3ebbc", "#ecf7fd", "#ded2da", "#cfe3e8", "#dfe2ec", "#dfe2ec"];
  const getRandomColor = () => {
    return colors[Math.round(Math.random() * colors.length)];
  }

  //const labelIcon = <FontAwesomeIcon className={styles.graphExportIcon} icon={faFileExport} size="2x" aria-label="graph-export" />

  const getNodes = () => {
    let nodes = props.entityTypes && props.entityTypes?.map((e) => {
      //const color = getRandomColor();
      const parts = e.entityName.split("-");
      const color = colors[parts.length];
      return {
        ...defaultNodeProps,
        id: e.entityName,
        label: e.entityName.concat("\n<b>", Math.round(Math.random()*10000), "</b>"),
        title: e.entityName + " tooltip text",
        color: {
          // background: entityMetadata[e.entityName].color,
          // border: entityMetadata[e.entityName].color,
          background: color,
          border: color,
          hover: {
            //border: '#2B7CE9',
            //background: 'red'
          }
        },
        // x: nodeP[e.entityName]?.x,
        // y: nodeP[e.entityName]?.y,
        hidden: false
      }
    });
    return nodes;
  }

  const getEdges = () => {
    let edges: any = [];
    props.entityTypes.forEach((e, i) => {
      console.log("e.model.definitions", e.model.definitions);
      let properties: any = Object.keys(e.model.definitions[e.entityName].properties);
      properties.forEach((p, i) => {
        if (e.model.definitions[e.entityName].properties[p].relatedEntityType) {
          let parts = e.model.definitions[e.entityName].properties[p].relatedEntityType.split("/");
          edges.push({
            from: e.entityName,
            to: parts[parts.length - 1],
            label: e.model.definitions[e.entityName].properties[p].joinPropertyName,
            arrows: "to",
            color: "#666",
            font: { align: "top" }
          });
        }
      });
    });
    return edges;
  }

  const options = {
    layout: {
      //hierarchical: true
      //randomSeed: "0.7696:1625099255200",
    },
    edges: {
      color: "#000000"
    },
    height: "500px",
    physics: {
      enabled: physicsEnabled,
      barnesHut: {
        springLength: 160,
        avoidOverlap: 0.4
      }
    },
    interaction:{
      hover:true
    },
    manipulation: {
      enabled: false,
      addNode: function (data, callback) {
          // filling in the popup DOM elements
          console.log('add', data);
      },
      editNode: function (data, callback) {
          // filling in the popup DOM elements
          console.log('edit', data);
      },
      addEdge: function (data, callback) {
          console.log('add edge', data);
          data.arrows = "to";
          data.color = "#666";
          callback(data);
          // Keep addEdgeMode on if "AddEdge" mode
          if (props.mode === "AddEdge") {
            network.addEdgeMode();
          }
      }
    }
  };

  const events = {
    select: (event) => {
      var { nodes, edges } = event;
      console.log('select', event);
    },
    dragStart: (event) => {
      if (physicsEnabled) {
        setPhysicsEnabled(false);
      }
    },
    dragEnd: (event) => {
      console.log('dragEnd', event, event.pointer.canvas);
      console.log('Testing network functions', network.getPositions(),network.getSelectedNodes())
      setNodePositions({ [event.nodes[0]]: event.pointer.canvas })
    },
    hoverNode: (event) => {
      console.log('on hover node', event.event.target.style.cursor);
      event.event.target.style.cursor = "pointer"
    },
    blurNode: (event) => {
      console.log('on blur node', event);
      event.event.target.style.cursor = ""
    },
    hoverEdge: (event) => {
      console.log('on hover edge', event.event.target.style.cursor);
      event.event.target.style.cursor = "pointer"
    },
    blurEdge: (event) => {
      console.log('on blur edge', event);
      event.event.target.style.cursor = ""
    },
    doubleClick: (event) => {
      console.log('doubleClick', event);
      if (event.nodes.length === 0 && event.edges.length === 0 && props.mode === "AddNode") {
        console.log('Empty clicked, AddNode mode');
        let newGraph = cloneDeep(graphData);

        //const newNodeId = Math.max(...newGraph.nodes.map(d => d.id)) + 1;
        const newNodeId = Math.floor(Math.random() * (10000 - 100) + 100);
        const newColor = Math.floor(Math.random() * (10000 - 100) + 100);
        const newNode = {
          ...defaultNodeProps,
          id: newNodeId,
          label: `Node ${newNodeId}`,
          title: `node ${newNodeId} tootip text`,
          // x: event.event.center.x,
          // y: event.event.center.y
          color: {
            background: getRandomColor(),
            border: getRandomColor(),
            hover: {
              //border: '#2B7CE9',
              //background: 'red'
            }
          }
        };
        newGraph.nodes.push(newNode);
        setGraphData(newGraph);
      }
    }
  };

  // Handle changes to graph mode
  useEffect(() => {
    if (props.mode === "AddEdge") {
      network.addEdgeMode();
    }
  }, [props.mode]);

  return (
    <div>
        <Graph
          graph={graphData}
          options={options}
          events={events}
          getNetwork={initNetworkInstance}
        />
      </div>
  );
};

export default GraphVis;
