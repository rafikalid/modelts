import { MethodDescriptor, ModelKind, ModelNode, ModelNodeWithChilds, ModelRoot, ObjectField } from "@src/schema/model";
import ts from "typescript";
import { compileAsserts } from "./ast-compile-assert";

/** Serialize AST */
export function serializeAST(root: ModelRoot, factory: ts.NodeFactory, importsMapper: Map<string, Map<string, ts.Identifier>>, PRETTY: boolean): ts.ObjectLiteralExpression{
	var nodeProperties: ts.ObjectLiteralElementLike[]= [];
	var result= factory.createObjectLiteralExpression(nodeProperties, PRETTY)
	const  results: ts.ObjectLiteralElementLike[][]= [nodeProperties];
	const queue: (ModelNode|ModelRoot)[]= [root];
	var i=0;
	// Serialize nodes
	while(i<queue.length){
		var node= queue[i];
		nodeProperties= results[i++];
		// Common fields
		nodeProperties.push(
			factory.createPropertyAssignment( factory.createIdentifier("name"), node.name==null? factory.createIdentifier("undefined") : factory.createStringLiteral(node.name)),
			factory.createPropertyAssignment( factory.createIdentifier("kind"), factory.createNumericLiteral(node.kind)),
			factory.createPropertyAssignment( factory.createIdentifier("jsDoc"), node.jsDoc==null? factory.createIdentifier("undefined") : factory.createStringLiteral(node.jsDoc))
		);
		// Add children
		if((node as ModelNodeWithChilds).children){
			let arrFields: ts.Expression[]= [];
			nodeProperties.push(
				factory.createPropertyAssignment(
					factory.createIdentifier("children"),
					factory.createArrayLiteralExpression( arrFields, PRETTY )
				)
			);
			(node as ModelNodeWithChilds).children.forEach(e=>{
				if(e==null){
					arrFields.push(factory.createIdentifier('undefined'));
				} else {
					let objF: ts.ObjectLiteralElementLike[]= [];
					arrFields.push(factory.createObjectLiteralExpression(objF, PRETTY));
					queue.push(e);
					results.push(objF);
				}
			});
		}
		// Custom fields
		switch(node.kind){
			/** Root model */
			case ModelKind.ROOT:
				break;
			case ModelKind.PLAIN_OBJECT:
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("isClass"), node.isClass ? factory.createTrue(): factory.createFalse())
				);
				break;
			case ModelKind.FIELD:
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("required"), (node as ObjectField).required ? factory.createTrue(): factory.createFalse())
				);
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("input"), node.input ? _serializeMethod(node.input, factory, importsMapper, PRETTY) : factory.createIdentifier('undefined'))
				);
				// Asserts
				nodeProperties.push(
					node.asserts &&
						compileAsserts(node.name, node.asserts, node.children[0], factory, PRETTY)
						|| factory.createPropertyAssignment(
							factory.createIdentifier("asserts"),
					 		factory.createIdentifier('undefined')
						)
				);
				// Resolver
				if((node as ObjectField).resolver){
					let fieldObjFields: ts.ObjectLiteralElementLike[]= [];
					nodeProperties.push(
						factory.createPropertyAssignment(factory.createIdentifier("resolver"), factory.createObjectLiteralExpression(fieldObjFields, PRETTY))
					);
					queue.push((node as ObjectField).resolver!);
					results.push(fieldObjFields);
				} else {
					nodeProperties.push(
						factory.createPropertyAssignment(factory.createIdentifier("resolver"), factory.createIdentifier('undefined'))
					);
				}
				break;
			case ModelKind.METHOD:
				nodeProperties.push(
					factory.createPropertyAssignment( factory.createIdentifier("method"), node.method ? _serializeMethod(node.method, factory, importsMapper, PRETTY) : factory.createIdentifier('undefined') )
				);
				break;
			// case ModelKind.REF:
			// 	nodeProperties.push(
			// 		factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createStringLiteral(node.value))
			// 	);
			// 	break;
			case ModelKind.CONST:
			case ModelKind.ENUM_MEMBER:
				nodeProperties.push(
					factory.createPropertyAssignment(
						factory.createIdentifier("value"),
						typeof node.value==='string' ?
							factory.createStringLiteral(node.value)
							: node.value==null ?
								factory.createIdentifier("undefined")
								: factory.createNumericLiteral(node.value)
					)
				);
				break;
			case ModelKind.SCALAR:
			case ModelKind.UNION:
				nodeProperties.push(
					// factory.createPropertyAssignment(factory.createIdentifier("parser"), node.parser)
					factory.createPropertyAssignment(factory.createIdentifier("parser"), _serializeMethod(node.parser as MethodDescriptor, factory, importsMapper, PRETTY))
				);
				break;
			// case ModelKind.DIRECTIVE:
			// 	nodeProperties.push(
			// 		factory.createPropertyAssignment( factory.createIdentifier("resolver"), prop.resolver)
			// 	);
		}
	}
	return result;
}


function _serializeMethod(method: MethodDescriptor, factory: ts.NodeFactory, importsMapper: Map<string, Map<string, ts.Identifier>>, pretty: boolean){
	if(typeof method==='string')
		return factory.createIdentifier(method);
	else{
		var fMap= importsMapper.get(method.fileName);
		if(!fMap) importsMapper.set(method.fileName, fMap= new Map());
		var uniqueN= fMap.get(method.className);
		if(!uniqueN){
			uniqueN= factory.createUniqueName(method.className);
			fMap.set(method.className, uniqueN);
		}
		var result:ts.Expression;
		if(!method.name)
			result= uniqueN;
		else if(method.isStatic)
			result= factory.createPropertyAccessChain(uniqueN, undefined, method.name);
		else
			result= factory.createPropertyAccessChain(
				factory.createPropertyAccessChain(uniqueN, undefined, 'prototype'),
				undefined,
				method.name
			)
		return result;
	}
	
	// return factory.createObjectLiteralExpression([
	// 	factory.createPropertyAssignment( factory.createIdentifier("fileName"), factory.createStringLiteral(method.fileName)),
	// 	factory.createPropertyAssignment( factory.createIdentifier("className"), factory.createStringLiteral(method.className)),
	// 	factory.createPropertyAssignment( factory.createIdentifier("name"), factory.createStringLiteral(method.name)),
	// 	factory.createPropertyAssignment( factory.createIdentifier("isStatic"), method.isStatic ? factory.createTrue(): factory.createFalse())
	// ], pretty);
}
