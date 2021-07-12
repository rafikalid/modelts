import { ModelBaseNode, ModelNode } from "@src/schema/model";
import ts from "typescript";

/** Interface */
export interface VisitorEntities<T>{
	node: T
	parentDescriptor: 	ModelNode|undefined
	directives ?:		ParseDirectivesReturn
	/** Distinguish methods if are input or output resolvers */
	isInput?: boolean
	/** Generic types mapping */
	generics?: Map<string, ts.TypeNode>
}

/** Parse directives return */
export interface ParseDirectivesReturn {
	ignore: boolean
	tsModel: boolean
	directives: ModelBaseNode['directives'],
	jsDoc: string | undefined
}

/** Visitor pattern using generators */
export class Visitor<T>{
	private _queue: VisitorEntities<T>[] = []
	constructor(nodes?: T | T[]) {
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
	push(nodes: T | T[], parentDescriptor?: ModelNode, isInput?: boolean, directives?: ParseDirectivesReturn, generics?: Map<string, ts.TypeNode>) {
		if(Array.isArray(nodes)){
			var q = [], i, len;
			for (i = 0, len = nodes.length; i < len; ++i) {
				q.push({ node: nodes[i], parentDescriptor, isInput, directives, generics });
			}
			this._queue.push(...q);
		} else this._queue.push({ node: nodes, parentDescriptor, isInput, directives, generics });
		return this;
	}
}
