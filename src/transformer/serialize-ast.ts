import { ModelKind, ModelNode, ModelNodeWithChilds, ObjectField, RootModel } from "@src/schema/model";
import ts from "typescript";

/** Serialize AST */
export function serializeAST<T extends ModelNode|RootModel>(root: T, factory: ts.NodeFactory, PRETTY: boolean): ts.ObjectLiteralExpression{
	var nodeProperties: ts.ObjectLiteralElementLike[]= [];
	var result= factory.createObjectLiteralExpression(nodeProperties, PRETTY)
	const  results: ts.ObjectLiteralElementLike[][]= [nodeProperties];
	const queue: (ModelNode|RootModel)[]= [root];
	var i=0;
	while(i<queue.length){
		var node= queue[i];
		nodeProperties= results[i++];
		// Common fields
		nodeProperties.push(
			factory.createPropertyAssignment( factory.createIdentifier("name"), node.name==null? factory.createIdentifier("undefined") : factory.createStringLiteral(node.name)),
			factory.createPropertyAssignment( factory.createIdentifier("kind"), factory.createNumericLiteral(node.kind)),
			factory.createPropertyAssignment( factory.createIdentifier("jsDoc"), node.jsDoc==null? factory.createIdentifier("undefined") : factory.createStringLiteral(node.jsDoc)),
			factory.createPropertyAssignment(
				factory.createIdentifier("directives"),
				node.directives==null?
					factory.createIdentifier("undefined")
					: factory.createArrayLiteralExpression(node.directives.map(e=> factory.createIdentifier(e)), PRETTY)
			)
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
					factory.createPropertyAssignment(factory.createIdentifier("input"), factory.createIdentifier((node as ObjectField).input || 'undefined'))
				);
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
					factory.createPropertyAssignment( factory.createIdentifier("method"), factory.createIdentifier(node.method) )
				);
				break;
			case ModelKind.REF:
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createStringLiteral(node.value))
				);
				break;
			case ModelKind.CONST:
			case ModelKind.ENUM_MEMBER:
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createIdentifier(node.value ?? "undefined"))
				);
				break;
			case ModelKind.SCALAR:
				nodeProperties.push(
					// factory.createPropertyAssignment(factory.createIdentifier("parser"), node.parser)
					factory.createPropertyAssignment(factory.createIdentifier("parser"), factory.createIdentifier(node.parser))
				);
				break;
			case ModelKind.UNION:
				nodeProperties.push(
					// factory.createPropertyAssignment(factory.createIdentifier("resolveType"), node.resolveType)
					factory.createPropertyAssignment(factory.createIdentifier("resolveType"), factory.createIdentifier(node.resolveType))
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