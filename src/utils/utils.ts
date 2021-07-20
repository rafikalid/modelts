import { ImportTokens, ModelBaseNode, ModelNode } from "@src/schema/model";
import ts from "typescript";

/** Interface */
export interface VisitorEntities<T>{
	node: T
	parentDescriptor: 	ModelNode|undefined
	/** Distinguish methods if are input or output resolvers */
	isInput: boolean
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
	push(nodes: T | readonly T[]|undefined, parentDescriptor: ModelNode|undefined, isInput: boolean) {
		var queue= this._queue;
		if(Array.isArray(nodes)){
			var i, len;
			for (i = 0, len = nodes.length; i < len; ++i) {
				queue.push({
					node: nodes[i],
					parentDescriptor,
					isInput
				});
			}
		} else if(nodes!= null) {
			queue.push({
				//@ts-ignore
				node: nodes,
				parentDescriptor,
				isInput
			});
		}
		return this;
	}
	/**
	 * Clear visitor
	 */
	clear(){
		this._queue.length= 0;
		return this;
	}
}
