import { ModelKind, RootModel, ModelNode, ModelObjectNode, ObjectField } from "@src/schema/model.js";
import ts, { PropertySignature } from "typescript";
//@ts-ignore
import treefy from 'treeify';


type TsClazzType= ts.ClassLikeDeclaration | ts.InterfaceDeclaration;

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createTransformer(){
	const mapRoots: Map<string, RootModel>= new Map();
	return {
		/** Before */
		before(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
			return function(sf: ts.SourceFile){
				// Prepare root node
				const root: RootModel= {
					models:	[],
					map:	{}
				};
				mapRoots.set(sf.fileName, root);
				// Visit node
				return ts.visitNode(sf, _visitor(ctx, sf, root));
			}
		},
		/** After */
		after(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile>{
			return function(sf: ts.SourceFile){
				// print node
				var fileName= sf.fileName;
				//- TEST
				var t= mapRoots.get(fileName);
				if(t?.models.length){
					console.log(sf.fileName, '>>\n');
					console.log(treefy.asTree( t.map , true ))
				}
				//- TEST
				function visitorCb(node: ts.Node): ts.VisitResult<ts.Node>{
					return ts.visitEachChild(node, visitorCb, ctx);
				}
				return ts.visitNode(sf, visitorCb);
			}
		}
	}
}

/** Visitor */
function _visitor(ctx:ts.TransformationContext, sf:ts.SourceFile, root: RootModel): ts.Visitor{
	/** Add entity */
	function _addEntity(entity: ModelNode, node: ts.Node){
		var calzzName= entity.name;
		if(!calzzName)
			throw new Error(`Expected entity name at: ${node.getStart()}`);
		if(root.map[calzzName])
			throw new Error(`Duplicated entity name: ${calzzName}`);
		root.map[calzzName]= entity;
		root.models.push(entity);
	}
	/** Visitor callback */
	function visitorCb(parentNode: ModelNode|undefined ,node: ts.Node): ts.VisitResult<ts.Node>{
		// Classes & interfaces
		var currentNode: ModelNode|undefined;
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.TypeLiteral:
				if(parentNode || _isTsModel(node)){
					currentNode= {
						name:		(node as TsClazzType).name?.getText(),
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		undefined,
						fields:		[],
						fieldMap:	{}
					};
					if(parentNode)
						(parentNode as ObjectField).value= currentNode;
					else
						_addEntity(currentNode, node);
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
				break;
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
						value:		undefined
					};
					parentNode.fields.push(currentNode);
					parentNode.fieldMap[currentNode.name!]= currentNode;
					var i, len, childs= node.getChildren();
					for(i=0, len=childs.length; i<len; i++){
						visitorCb(currentNode, childs[i]);
					}
					return node;
				} else {
					console.log('---------------- found property without parent class: ', node.getText())
				}
				break;
			case ts.SyntaxKind.QuestionToken:
				// make field optional
				if(parentNode && parentNode.kind === ModelKind.FIELD){
					parentNode.required= false;
				}
				break;
			case ts.SyntaxKind.JSDocComment:
				if(parentNode){
					parentNode.jsDoc= node.getText().replace(/^\s*\*|^\s*\/\*\*|\s*\*\/\s*$/gm, '');
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
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentNode.value= {
								kind:	ModelKind.REF,
								name:	undefined,
								jsDoc:	undefined,
								value:	node.getText()
							}
							break;
						default:
							console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					}
				}
				// string
				break
			case ts.SyntaxKind.ArrayType:
				currentNode= {
					kind:	ModelKind.LIST,
					name:	undefined,
					jsDoc:	undefined,
					value:	undefined
				}
				if(parentNode){
					switch(parentNode.kind){
						case ModelKind.FIELD:
						case ModelKind.LIST:
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentNode.value= currentNode;
							break;
						default:
							console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					}
				}
				break;
			/** Tuple as Multipe types */
			case ts.SyntaxKind.TupleType:
				throw new Error(`Tuples are not supported, do you mean multiple types? at: ${node.getStart()}`);
			/** Method declaration */
			case ts.SyntaxKind.MethodDeclaration:
				if(parentNode){
					if(parentNode.kind!== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					currentNode= {
						kind:		ModelKind.METHOD,
						name:		(node as ts.MethodDeclaration).name.getText(),
						jsDoc:		undefined,
						value:		undefined,
						argParam:	undefined
					}
					parentNode.fields.push(currentNode);
					parentNode.fieldMap[currentNode.name!]= currentNode;
					// Go trough childs
					var i, len, childs= node.getChildren();
					for(i=0, len=childs.length; i<len; i++){
						visitorCb(currentNode, childs[i]);
					}
					// Go through arg param
					var params= (node as ts.MethodDeclaration).parameters;
					if(params && params.length>2){
						visitorCb(currentNode, params[1]);
					}
					return node;
				}
				break;
			case ts.SyntaxKind.Parameter:
				if(parentNode){
					if(parentNode.kind !== ModelKind.METHOD)
						throw new Error(`Enexpected param access at ${node.getStart()}`);
					currentNode= {
						kind:	ModelKind.PARAM,
						name:	(node as ts.ParameterDeclaration).name.getText(),
						jsDoc:	undefined,
						value:	undefined
					};
					parentNode.argParam= currentNode;
				}
				break;
			default:
				console.log(`${ts.SyntaxKind[node.kind]}: ${node.getFullText()}`)
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

