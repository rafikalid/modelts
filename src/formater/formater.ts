import { FormatedInputNode, FormatedInputObject, FormatedOutputNode, FormatedOutputObject } from "./formater-model";
import { Field, ModelKind, Node, PlainObject } from "../parser/model";

/** Format parsed results to generate usable model */
export function format(root: Map<string, Node>): FormatReponse {
	const result: FormatReponse={
		input:	new Map(),
		output:	new Map()
	};
	const inputMap= result.input;
	const outputMap= result.output;
	/** Map objects with resolved fields */
	const resolvedObjects: Map<PlainObject, Map<string, Field>>= new Map();
	//* Go through nodes
	root.forEach(function(node, nodeName){
		switch(node.kind){
			case ModelKind.BASIC_SCALAR:
			case ModelKind.SCALAR:
			case ModelKind.ENUM:
			case ModelKind.UNION:
				inputMap.set(nodeName, node);
				outputMap.set(nodeName, node);
				break;
			case ModelKind.PLAIN_OBJECT:
				// Ignore generic objects
				if(node.generics!=null) break;
				//* Resolve fields
				let fields:Map<string, Field>= new Map(node.fields);
				// Include inhireted fields
				// if(node.inherit!=null){
				// 	for(let i=0, inherited= node.inherit, len= inherited.length; i<len; ++i){
				// 		let ref= inherited[i];
				// 		let inheritedFields= _resolveFields(ref);
				// 	}
				// }
				break;
			default:
				throw new Error(`Unknown kind: ${ModelKind[node.kind]}`);
		}
	});
	return result;
	/** Resolve palin object fields */
	function _resolveFields(node: PlainObject){
		var fields= resolvedObjects.get(node);
		if(fields!=null) return fields;
		// Resolve fields, Go through inheritance tree
		fields= new Map(node.fields);
		var queue= [node];
		while(true){
			
		}
	}
}


/** Format response */
export interface FormatReponse{
	input:	Map<string, FormatedInputNode>
	output:	Map<string, FormatedOutputNode>
}