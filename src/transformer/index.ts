import { ModelKind, ModelObjectNode, ObjectField, RootModel, ModelNode } from "@src/schema/model.js";
import ts, { PropertySignature } from "typescript";


type TsClazzType= ts.ClassLikeDeclaration | ts.InterfaceDeclaration;

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createBeforeTransformer(){
	// return transformer
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
		return function(sf: ts.SourceFile){ return ts.visitNode(sf, _visitor(ctx, sf)); }
	}
}

/** Visitor */
function _visitor(ctx:ts.TransformationContext, sf:ts.SourceFile): ts.Visitor{
	/** Root class */
	const root: RootModel= {
		models:	[],
		map:	{}
	}
	/** Visitor callback */
	function visitorCb(parentNode: ModelNode|undefined ,node: ts.Node): ts.VisitResult<ts.Node>{
		// Classes & interfaces
		var currentNode: ModelNode|undefined;
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				// Classes and interfaces could not have parent node (at least for now)
				if(parentNode)
					throw new Error(`Enexpected ${parentNode.name}::${ts.SyntaxKind[node.kind]} at line: ${node.getStart()}`);
				if(_isTsModel(node)){
					if(!(node as TsClazzType).name)
						throw new Error(`Expected interface name at: ${node.getStart()}`);
					currentNode= {
						name:		(node as TsClazzType).name!.getText(),
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		undefined,
						fields:		[],
						fieldMap:	{}
					}
				}
				break;
			case ts.SyntaxKind.EnumDeclaration:
				console.log('----------------------------------------->> ENUM: ')
				if(_isTsModel(node)){
					console.log(node.getFullText());
				}
				break;
			case ts.SyntaxKind.TypeAliasDeclaration:
				console.log('----------------------------------------->> TYPE: ')
				if(_isTsModel(node)){
					console.log(node.getFullText());
				}
				break
			case ts.SyntaxKind.PropertySignature:
				// Class or interface property
				if(parentNode){
					if(parentNode.kind!== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					currentNode={
						kind:		ModelKind.FIELD,
						name:		(node as PropertySignature).name.getText(),
						jsDoc:		undefined,
						required:	true,
						ref:		undefined
					};
					parentNode.fields.push(currentNode);
					parentNode.fieldMap[currentNode.name!]= currentNode;
				} else {
					console.log('---------------- found property without parent class')
				}
			case ts.SyntaxKind.ArrayType:
				// TODO
				break;
			case ts.SyntaxKind.TypeLiteral:
				//TODO syntax value as new object
				break;
			case ts.SyntaxKind.QuestionToken:
				// make field optional
				if(parentNode && parentNode.kind === ModelKind.FIELD){
					parentNode.required= false;
				}
				break;
			case ts.SyntaxKind.JSDocComment:
				if(parentNode){
					parentNode.jsDoc= node.getChildren().map(e=> e.getText()).join("\n");
				}
				break;
			case ts.SyntaxKind.TypeReference:
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
				if(parentNode){
					switch(parentNode.kind){
						case ModelKind.FIELD:
						case ModelKind.LIST:
							parentNode.ref= node.getText();
							break;
					}
				}
				// string
				break
			case ts.SyntaxKind.ArrayType:
				// console.log('Array: ', (node as ts.ArrayTypeNode).elementType)
				currentNode= {
					kind:	ModelKind.LIST,
					name:	undefined,
					jsDoc:	undefined,
					ref:	undefined
				}
				break;
			/** Tuple as Multipe types */
			case ts.SyntaxKind.TupleType:
				throw new Error(`Tuples are not supported, do you mean multiple types? at: ${node.getStart()}`);
			// default:
			// 	console.log(`${ts.SyntaxKind[node.kind]}: ${node.getFullText()}`)
		}
		return ts.visitEachChild(node, visitorCb.bind(null, currentNode), ctx);
	}
	/** Return */
	return visitorCb.bind(null, undefined);
}

/** Check has not "@tsmodel" flag */
function _isTsModel(node: ts.Node):boolean{
	var childs= node.getChildren();
	var i, len;
	for (i=0, len=childs.length; i < len; i++) {
		const childNode = childs[i];
		if(ts.isJSDoc(childNode)){
			var childNodes= childNode.getChildren();
			for (let j = 0, jLen= childNodes.length; j < jLen; j++) {
				if(childNodes[j].getFullText().includes('@tsmodel')) { return true }
			}
		}
	}
	return false;
}

