import { GqlField, GqlListNode, GqlNode, GqlObjectNode } from "@src/compiler/gql-model";
import { InputResolver } from "@src/helpers/interfaces";
import { ModelKind } from "@src/schema/model";
import type { GraphQLFieldResolver } from "graphql";

/** Validate input data */
export function inputValidationWrapper(config: GqlObjectNode, method: GraphQLFieldResolver<any, any, any>): GraphQLFieldResolver<any, any, any>{
	return function(parent: any, args: any, ctx:any, info: any){
		args= _validate(config, args, ctx, info);
		return method(parent, args, ctx, info);
	}
}

/** Validate data */
function _validate(config: GqlObjectNode, data: any, ctx:any, info: any){
	// Check data
	const queue: QueueItem[]= [{ node: config, parentData: undefined, data, index: 0 }];
	var assertCb: GqlField['assert'];
	var inputCb: GqlField['input'];
	var fieldType: GqlNode | undefined;
	while(true){
		// Get node info
		let queueLen= queue.length;
		if(queueLen===0) break;
		let currentNode= queue[queueLen-1];
		let {node, data, parentData, index}= currentNode;
		let resolved= true;
		// Switch type
		switch(node.kind){
			case ModelKind.PLAIN_OBJECT:
				{
					let field= node.fields[index];
					let fieldData: any;
					if(field != null && (fieldData= data[field.name]) != null){
						queue.push({node: field, parentData: data, data: fieldData, index: 0});
						resolved= false;
					}
				}
				break;
			case ModelKind.FIELD:
				fieldType= node.type;
				if(fieldType==null || index > 0){
					// Asserts
					assertCb= node.assert
					if(assertCb!=null) assertCb(data);
					// input value
					inputCb= node.input;
					if(inputCb!=null)
						parentData[node.name]= data= inputCb(parentData, data, ctx, info);
				} else {
					queue.push({node: fieldType, parentData, data, index: 0});
					resolved= false;
				}
				break;
			case ModelKind.LIST:
				fieldType= node.type;
				if(fieldType==null || index > data.length){
					// asserts
					assertCb= node.assert;
					if(assertCb!=null){
						for(let i=0, len= (data as Array<any>).length; i<len; ++i)
							assertCb(data[i]);
					}
					inputCb= node.input;
					if(inputCb!=null){
						for(let i=0, len= (data as Array<any>).length; i<len; ++i)
							data[i]= inputCb(data, data[i], ctx, info);
					}
				} else {
					//* Go through items
					queue.push({node: fieldType, parentData: data, data: data[index], index: 0});
					resolved= false;
				}
				break;
		}
		++currentNode.index;
		if(resolved){
			queue.pop();
		}
	}
}

interface QueueItem {
	node: GqlObjectNode|GqlField|GqlListNode
	parentData: any,
	data: any
	index: number
}