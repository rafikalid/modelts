import { ModelBaseNode, ModelNode } from "@src/schema/model";
import ts from "typescript";

/** Interface */
export type VisitorNode = ts.Node | SymbolTypeNode
export interface VisitorEntities{
	node: VisitorNode
	parentDescriptor: 	ModelNode|undefined
	directives ?:		ParseDirectivesReturn
	/** Distinguish methods if are input or output resolvers */
	isInput?: boolean
}

/** Symbol type node */
export const nodeTypeKind = Symbol();
export interface SymbolTypeNode {
	kind: symbol,
	name: string,
	nType: ts.Type
}

/** Parse directives return */
export interface ParseDirectivesReturn {
	ignore: boolean
	tsModel: boolean
	directives: ModelBaseNode['directives'],
	jsDoc: string | undefined
}

/** Visitor pattern using generators */
export class Visitor{
	private _queue: VisitorEntities[] = []
	constructor(nodes?: VisitorNode | VisitorNode[]) {
		if(nodes)
			this.push(nodes);
	}

	/** Get next element */
	*it() {
		var i = 0;
		var q = this._queue;
		while (i < q.length) {
			yield q[i++];
		}
	}
	/** Push items */
	push(nodes: VisitorNode | VisitorNode[], parentDescriptor?: ModelNode, isInput?: boolean, directives?: ParseDirectivesReturn) {
		if(Array.isArray(nodes)){
			var q = [], i, len;
			for (i = 0, len = nodes.length; i < len; ++i) {
				q.push({ node: nodes[i], parentDescriptor, isInput, directives });
			}
			this._queue.push(...q);
		} else this._queue.push({ node: nodes, parentDescriptor, isInput, directives });
		return this;
	}
}
