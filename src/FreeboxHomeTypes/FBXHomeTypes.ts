
export enum FBXHomeNodeVisibility {
    //internal	For internal use only, never exposed
    // normal	The endpoint is available for scenarii but does not display info to the user
    normal = 'normal',
    // dashboard	The endpoint expose data that can be displayed on UI
    dashboard = 'dashboard',
}
export enum FBXHomeNodeEndPointType {
    //ep_type	Description
    // 	The endpoint outputs an information
    signal = 'signal',
    // 	A endpoint that controls the object
    slot = 'slot',
}
export interface FBXHomeNodeEndpointValue {
    // The current value of the endpoint
    value: string;

    // The displayable unit of the value
    unit?: string;

    // The period this value need to be refreshed
    refresh?: number;

    // The type of value this enpoint expose
    value_type: 'bool' | 'int' | 'float' | 'void' | 'string';
}
export type FBXNodeAccessMode = 'r' | 'w' | 'rw';

export interface FBXHomeNodeEndpoint {
    // ???
    category?: string;

    //The endpoint type
    ep_type: FBXHomeNodeEndPointType;

    //Visibility level of this endpoint
    visibility: FBXHomeNodeVisibility;

    //The endpoint id
    id: number;

    // Access mode of this endpoint
    access?: FBXNodeAccessMode; //'r' | 'w' | 'rw';
    // r	Read only
    // w	Write only
    // rw	Read and write

    label?: string; // "État",
    name?: string; // "state",
    param_type?: string; // "void",
    value_type: string; // "string"
    ui?: {
        access: FBXNodeAccessMode;
        display: string;
        icon_url: string;
        range: Array<number>[2];
        unit: string;
    };
}
export interface FBXHomeNodeLink {

}

export enum FBXNodeStatus {
    // The adapter is not reachable
    unreachable = 'unreachable',
    // 	The node has been disabled
    disabled = 'disabled',
    // 	The node is connected
    active = 'active',
    // 	The node has not been paired to any network
    unpaired = 'unpaired'
}
// export interface FBXHomeNodeEndpointLight {
//     // ep_type : string; // "signal",
//     // id : number; // 5,
//     // label : string; // "État",
//     // name : string; // "state",
//     // param_type? : string; // "void",
//     // value_type : string; // "string"
//     // visiblity : string; // "normal"

// }
export interface FBXHomeNodeType {
    //The node icon name or url
    icon: string;

    //The node displayable type
    labelDisplay: string;

    //The node type technical name
    name: string;

    //True when the node is an actual connected object, false when it’s a virtual node
    physical: boolean;

    // following deduced from actual returns
    params?: unknown;
    inherit?: unknown;
    generic: boolean;
    abstract: boolean;
    endpoints: Array<FBXHomeNodeEndpoint>;
}
export enum FBXHomeNodeCategory {
    alarm = 'alarm',
    shutter = 'shutter',
    camera = 'camera',
    motion_sensor = 'pir',
    contact_sensor = 'dws',
}
export interface FBXHomeNode {
    // Id of the HomeAdapter this node is connected to.
    adapter: number;

    // ???
    category: FBXHomeNodeCategory; //string;

    //Id of this node.
    id: number;

    //Displayable name of this node
    label: string;

    //Technical name of this node
    name: string;

    // Endpoints exposed by this node
    show_endpoints: Array<FBXHomeNodeEndpoint>;

    //Links from other objects to this node signals
    signal_links: Array<FBXHomeNodeLink>;

    //Links from other objects to this node slots
    slot_links: Array<FBXHomeNodeLink>;

    // Status of this node
    status: FBXNodeStatus;

    //Node type info
    type: FBXHomeNodeType;

}
export interface FBXNodesResult {
    success: boolean;
    result: Array<FBXHomeNode>;
}
export interface FBXEndPointResult {
    success: boolean;
    result: FBXHomeNodeEndpointValue;
}