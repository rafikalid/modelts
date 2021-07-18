import { ImportTokens, ModelBaseNode, ModelNode } from "@src/schema/model";
import ts from "typescript";

/** Interface */
export interface VisitorEntities<T>{
	node: T
	parentDescriptor: 	ModelNode|undefined
	/** Distinguish methods if are input or output resolvers */
	isInput: boolean
	/** Generic types mapping */
	generics: Map<string, ts.TypeNode>|undefined
	/** Current file name */
	fileName:	string
	/** Current file import tokens */
	importTokens: ImportTokens
}

/** Visitor pattern using generators */
export class Visitor<T>{
	private _queue: VisitorEntities<T>[] = [];

	/** Get next element */
	*it() {
		var i = 0;
		var q = this._queue;
		while (i < q.length) {
			yield q[i++];
		}
	}
	/** Push items */
	push(nodes: T | readonly T[]|undefined, parentDescriptor: ModelNode|undefined, isInput: boolean, fileName: string, importTokens: ImportTokens, generics?: Map<string, ts.TypeNode>) {
		var queue= this._queue;
		if(Array.isArray(nodes)){
			var i, len;
			for (i = 0, len = nodes.length; i < len; ++i) {
				queue.push({
					node: nodes[i],
					parentDescriptor,
					isInput,
					fileName,
					importTokens,
					generics
				});
			}
		} else if(nodes!= null) {
			queue.push({
				//@ts-ignore
				node: nodes,
				parentDescriptor,
				isInput,
				fileName,
				importTokens,
				generics
			});
		}
		return this;
	}
}
