import { ModelKind, RootModel, ModelNode, ObjectField, MethodAttr, ModelNodeWithChilds } from "@src/schema/model.js";
import ts, { PropertySignature } from "typescript";
//@ts-ignore
import treefy from 'treeify';

//FIXME
const PACKAGE_NAME= '"@src/index.js"';


type TsClazzType = ts.ClassLikeDeclaration | ts.InterfaceDeclaration;

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createTransformer() {
	const mapRoots: Map<string, RootModel> = new Map();
	return {
		/** Before */
		before(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
			return function (sf: ts.SourceFile) {
				console.log('FILE>>: ', sf.fileName)
				// Prepare root node
				const root: RootModel = {
					mapChilds:	{},
					children:	[],
					modelFx:	undefined
				};
				mapRoots.set(sf.fileName, root);
				// Visit node
				return ts.visitNode(sf, _visitor(ctx, sf, root));
			}
		},
		/** After */
		after(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
			return function (sf: ts.SourceFile) {
				console.log('AFTER FILE>>: ', sf.fileName)
				function visitorCb(node: ts.Node): ts.VisitResult<ts.Node> {
					var fileName = sf.fileName;
					var t = mapRoots.get(fileName);
					if (t?.children.length) {
						return ts.visitEachChild(node, _addAst(t, ctx), ctx);
					} else {
						return node;
					}
				}
				return ts.visitNode(sf, visitorCb);
			}
		}
	}
}

/** Visitor */
function _visitor(ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel): ts.Visitor {
	/** Add entity */
	function _addEntity(entity: ModelNode, node: ts.Node) {
		var calzzName = entity.name;
		if (!calzzName)
			throw new Error(`Expected entity name at: ${node.getStart()}`);
		if (root.mapChilds[calzzName])
			throw new Error(`Duplicated entity name: ${calzzName}`);
		root.mapChilds[calzzName] = entity;
		root.children.push(entity);
	}
	/** Visitor callback */
	function visitorCb(parentNode: ModelNode | undefined, node: ts.Node): ts.VisitResult<ts.Node> {
		// Classes & interfaces
		var currentNode: ModelNode | undefined;
		switch (node.kind) {
			case ts.SyntaxKind.ImportDeclaration:
				_parseModelImportTags(node as ts.ImportDeclaration, root);
				break;
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.TypeLiteral:
				if (parentNode || _isTsModel(node)) {
					currentNode = {
						name:		(node as TsClazzType).name?.getText(),
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		undefined,
						directives:	undefined,
						children:	[],
						mapChilds:	{},
						isClass:	node.kind === ts.SyntaxKind.ClassDeclaration
					};
					if (parentNode)
						// Field
						(parentNode as ObjectField).children.push(currentNode);
					else
						_addEntity(currentNode, node);
				} else {
					return node;
				}
				break;
			case ts.SyntaxKind.EnumDeclaration:
				if (_isTsModel(node)) {
					currentNode = {
						name:		(node as ts.EnumDeclaration).name?.getText(),
						kind:		ModelKind.ENUM,
						jsDoc:		undefined,
						directives:	undefined,
						children:	[],
						mapChilds:	{}
					};
					if (parentNode)
						// Field
						(parentNode as ObjectField).children.push(currentNode);
					else
						_addEntity(currentNode, node);
				} else {
					return node;
				}
				break;
			case ts.SyntaxKind.TypeAliasDeclaration:
				if (_isTsModel(node)) {
					console.log('----------------------------------------->> TYPE: ')
					// console.log(node.getFullText());
				}
				break;
			case ts.SyntaxKind.PropertySignature:
				// Class or interface property
				if (parentNode) {
					if (parentNode.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					currentNode = {
						kind: ModelKind.FIELD,
						name: (node as PropertySignature).name.getText(),
						jsDoc: undefined,
						directives:	undefined,
						required: true,
						children: []
					};
					parentNode.children.push(currentNode);
					parentNode.mapChilds[currentNode.name!] = currentNode;
					var i, len, childs = node.getChildren();
					for (i = 0, len = childs.length; i < len; i++) {
						visitorCb(currentNode, childs[i]);
					}
					return node;
				} else {
					console.log('---------------- found property without parent class: ', node.getText())
				}
				break;
			case ts.SyntaxKind.EnumMember:
				if(parentNode){
					if (parentNode.kind!== ModelKind.ENUM)
						throw new Error(`Expected parent node to ENUM, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					currentNode = {
						kind: ModelKind.ENUM_MEMBER,
						name: (node as PropertySignature).name.getText(),
						jsDoc: undefined,
						directives:	undefined,
						required: true,
						children: []
					};
					parentNode.children.push(currentNode);
					parentNode.mapChilds[currentNode.name!] = currentNode;
					var i, len, childs = node.getChildren();
					var child;
					for (i = 0, len = childs.length; i < len; i++) {
						child= childs[i];
						visitorCb(currentNode, child);
						if(child.kind === ts.SyntaxKind.FirstAssignment){
							currentNode.children.push({
								kind:	ModelKind.CONST,
								name:	undefined,
								jsDoc:	undefined,
								directives:	undefined,
								value:	childs[i+1].getText()
							});
						}
					}
					return node;
				} else {
					throw new Error(`Enexpected enum member at: ${node.getText()}: ${node.getStart()}`)
				}
				break;
			case ts.SyntaxKind.QuestionToken:
				// make field optional
				if (parentNode && parentNode.kind === ModelKind.FIELD) {
					parentNode.required = false;
				}
				break;
			case ts.SyntaxKind.JSDocComment:
				if (parentNode) {
					// Save jsDoc
					parentNode.jsDoc = node.getText().replace(/^\s*\*|^\s*\/\*\*|\s*\*\/\s*$/gm, '');
					// Check for jsDoc directives
					let i, len, child, childs= node.getChildren();
					for(i=0, len=childs.length; i<len; ++i){
						child= childs[i];
						let directiveToken= child.getFirstToken();
						if(directiveToken){
							let directiveName= directiveToken.getText()!;
							(parentNode.directives??= []).push(directiveName, child.getText().substr(directiveName.length+2));
						}
					}
				}
				break;
			case ts.SyntaxKind.TypeReference:
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
			// case ts.SyntaxKind.VoidKeyword:
			// case ts.SyntaxKind.AnyKeyword:
				if (parentNode) {
					switch (parentNode.kind) {
						case ModelKind.FIELD:
						case ModelKind.LIST:
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentNode.children[0] = {
								kind: ModelKind.REF,
								name: undefined,
								jsDoc: undefined,
								directives:	undefined,
								value: node.getText()
							}
							break;
						default:
							console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					}
				}
				// string
				break
			case ts.SyntaxKind.ArrayType:
				currentNode = {
					kind:	ModelKind.LIST,
					name:	undefined,
					jsDoc:	undefined,
					directives:	undefined,
					children: []
				}
				if (parentNode) {
					switch (parentNode.kind) {
						case ModelKind.FIELD:
						case ModelKind.LIST:
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentNode.children[0] = currentNode;
							break;
						default:
							console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} at ${node.getText()}: ${node.getStart()}`);
					}
				}
				break;
			/** Tuple as Multipe types */
			case ts.SyntaxKind.TupleType:
				throw new Error(`Tuples are not supported, do you mean multiple types? at: ${node.getText()}: ${node.getStart()}`);
			/** Method declaration */
			case ts.SyntaxKind.MethodDeclaration:
				if (parentNode) {
					if (parentNode.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getText()}: ${node.getStart()}`);
					var methodName= (node as ts.MethodDeclaration).name.getText();
					currentNode = {
						kind:		ModelKind.METHOD,
						name:		methodName,
						jsDoc:		undefined,
						directives:	undefined,
						// method:		node as ts.MethodDeclaration,
						method: `${parentNode.name}.prototype.${methodName}`,
						/** [ResultType, ParamType] */
						children:	[undefined, undefined],
					};
					parentNode.children.push(currentNode);
					parentNode.mapChilds[currentNode.name!] = currentNode;
					// Go trough childs
					var i, len, childs = node.getChildren();
					for (i = 0, len = childs.length; i < len; i++) {
						visitorCb(currentNode, childs[i]);
					}
					// Go through arg param
					var params = (node as ts.MethodDeclaration).parameters;
					if (params && params.length > 2) {
						visitorCb(currentNode, params[1]);
					}
					return node;
				}
				break;
			case ts.SyntaxKind.Parameter:
				if (parentNode) {
					if (parentNode.kind !== ModelKind.METHOD)
						throw new Error(`Enexpected param access at ${node.getStart()}`);
					currentNode = {
						kind: ModelKind.PARAM,
						name: (node as ts.ParameterDeclaration).name.getText(),
						jsDoc: undefined,
						directives:	undefined,
						children: []
					};
					parentNode.children[1] = currentNode;
				}
				break;
			/** Variable statement: create new scalar, union, ... */
			case ts.SyntaxKind.VariableDeclaration:
				_parseModelDirective(node as ts.VariableDeclaration, root);
				break;
			// default:
			// 	console.log(`${ts.SyntaxKind[node.kind]}: ${node.getFullText()}`)
		}
		return ts.visitEachChild(node, visitorCb.bind(null, currentNode), ctx);
	}
	/** Return */
	return visitorCb.bind(null, undefined);
}

/** Check has not "@tsmodel" flag */
function _isTsModel(node: ts.Node): boolean {
	var childs = node.getChildren();
	var i, len;
	for (i = 0, len = childs.length; i < len; i++) {
		const childNode = childs[i];
		if (ts.isJSDoc(childNode)) {
			var childNodes = childNode.getChildren();
			for (let j = 0, jLen = childNodes.length; j < jLen; j++) {
				if (/^@tsmodel\b/.test(childNodes[j].getText())) { return true }
			}
		}
	}
	return false;
}

function _parseModelImportTags(node: ts.ImportDeclaration, root: RootModel){
	var i, len, childs = node.getChildren(), child;
	var isModelImport = false;
	var strImport;
	rtLoop: for (i = 0, len = childs.length; i < len; ++i) {
		child = childs[i];
		switch (child.kind) {
			case ts.SyntaxKind.ImportClause:
				strImport = child.getText();
				break;
			case ts.SyntaxKind.StringLiteral:
				if (child.getText() === PACKAGE_NAME) {
					isModelImport = true;
					break rtLoop;
				}
				break;
		}
	}
	var m;
	if (isModelImport && strImport) {
		if(m = strImport.match(/\bModel\b(?: as (\w+))?/))
			root.modelFx= m[1] || m[0];
		else if(m= strImport.match(/\bModelScalar\b(?: as (\w+))?/))
			root._importScalar= m[1] || m[0];
		else if(m= strImport.match(/\bUNION\b(?: as (\w+))?/))
			root._importUnion= m[1] || m[0];
		else if(m= strImport.match(/\bJsDocDirective\b(?: as (\w+))?/))
			root._importDirective= m[1] || m[0];
	}
}

/** Apply AST visitor */
function _addAst(root: RootModel, ctx: ts.TransformationContext) {
	function vst(node: ts.Node): ts.Node {
		switch (node.kind) {
			case ts.SyntaxKind.NewExpression:
				if (node.getChildAt(1).getText() === root.modelFx) {
					// convert
					return ctx.factory.createNewExpression(
						(node as ts.NewExpression).expression,
						(node as ts.NewExpression).typeArguments,
						[_serializeAST(root, ctx)],
					);
					// return ctx.factory.updateNewExpression(
					// 	node as ts.NewExpression,
					// 	(node as ts.NewExpression).expression,
					// 	(node as ts.NewExpression).typeArguments,
					// 	[_serializeAST(root, ctx)],
					// )
				}
				break;
		}
		return ts.visitEachChild(node, vst, ctx);
	}
	return vst;
}

/** Serialize AST */
function _serializeAST(root: RootModel, ctx: ts.TransformationContext): ts.Expression{
	const factory= ctx.factory;
	var fields:ts.Expression[]|undefined;
	const results: ts.Expression[][]= [[]];
	const queue: ModelNode[][]= [root.children];
	//-------
	var i, props= root.children;
	var j,jLen, prop, fieldNodes;
	for(i=0; i<queue.length; ++i){
		props= queue[i];
		fieldNodes= results[i];
		for(j=0, jLen= props.length; j<jLen; ++j)
			if(prop= props[j]){
				// Common fields
				var nodeProperties: ts.ObjectLiteralElementLike[]= [
					factory.createPropertyAssignment( factory.createIdentifier("name"), prop.name==null? factory.createIdentifier("undefined") : factory.createStringLiteral(prop.name)),
					factory.createPropertyAssignment( factory.createIdentifier("kind"), factory.createNumericLiteral(prop.kind)),
					factory.createPropertyAssignment( factory.createIdentifier("jsDoc"), prop.jsDoc==null? factory.createIdentifier("undefined") : factory.createStringLiteral(prop.jsDoc)),
					factory.createPropertyAssignment(
						factory.createIdentifier("directives"),
						prop.directives==null?
							factory.createIdentifier("undefined")
							: factory.createArrayLiteralExpression(prop.directives.map(l=> factory.createStringLiteral(l)), true)
					)
				];
				switch(prop.kind){
					case ModelKind.PLAIN_OBJECT:
						nodeProperties.push(
							// isClass
							factory.createPropertyAssignment(factory.createIdentifier("isClass"), prop.isClass ? factory.createTrue(): factory.createFalse())
						);
					case ModelKind.FIELD:
						nodeProperties.push(
							factory.createPropertyAssignment(factory.createIdentifier("required"), (prop as ObjectField).required ? factory.createTrue(): factory.createFalse())
						);
						break;
					case ModelKind.METHOD:
						nodeProperties.push(
							factory.createPropertyAssignment(
								factory.createIdentifier("method"),
								factory.createIdentifier(prop.method)
							)
						);
						// nodeProperties.push(
						// 	factory.createMethodDeclaration(
						// 		undefined, //method.decorators,
						// 		undefined, //method.modifiers,
						// 		method.asteriskToken,
						// 		factory.createIdentifier('method'),
						// 		method.questionToken,
						// 		undefined, //method.typeParameters,
						// 		method.parameters,
						// 		undefined, //method.type,
						// 		method.body
						// 	)
						// );
						break;
					case ModelKind.REF:
						nodeProperties.push(
							factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createStringLiteral(prop.value))
						);
						break;
					case ModelKind.CONST:
						nodeProperties.push(
							factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createIdentifier(prop.value))
						);
						break;
				}
				// Add children
				if((prop as ModelNodeWithChilds).children){
					fields= [];
					nodeProperties.push(
						factory.createPropertyAssignment(
							factory.createIdentifier("children"),
							factory.createArrayLiteralExpression( fields, true )
						)
					);
					queue.push((prop as ModelNodeWithChilds).children);
					results.push(fields);
				}
				// Add to parent
				fieldNodes.push(factory.createObjectLiteralExpression(nodeProperties));
			} else {
				fieldNodes.push(factory.createIdentifier('undefined'));
			}
	}
	return factory.createObjectLiteralExpression([
		//Models
		factory.createPropertyAssignment(
			factory.createIdentifier("children"),
			factory.createArrayLiteralExpression( results[0], true )
		),
	]);
	//return ctx.factory.createIdentifier(JSON.stringify(root));
}

/** Create Scalar, union or jsDoc directive */
function _parseModelDirective(node: ts.VariableDeclaration, root: RootModel) {
	var i, len, child, childs= node.getChildren();
	var typeReference;
	var scalarName: string;
	for(i=0, len=childs.length; i<len; ++i){
		child= childs[i];
		switch(child.kind){
			/** Parse type */
			case ts.SyntaxKind.TypeReference:
				typeReference= child.getFirstToken()!.getText();
				break;
			/** Literal object */
			case ts.SyntaxKind.ObjectLiteralExpression:
				switch(typeReference){
					case root._importScalar:
						scalarName= child.getLastToken()!.getText();
						if(root.mapChilds[scalarName])
							throw new Error(`Already defined entity ${scalarName} at ${child.getText()}: ${child.getStart()}`);
						root.children.push(root.mapChilds[scalarName]={
							kind:		ModelKind.SCALAR,
							name:		scalarName,
							jsDoc:		undefined,
							directives:	undefined,
							parser:		node.name.getText()
						});
						break;
					case root._importUnion:
						scalarName= node.name.getText();
						if(root.mapChilds[scalarName])
							throw new Error(`Already defined entity ${scalarName} at ${node.getText()}: ${node.getStart()}`);
						//FIXME parse union types
						root.children.push(root.mapChilds[scalarName]={
							kind:			ModelKind.UNION,
							name:			scalarName,
							jsDoc:			undefined,
							directives:		undefined,
							resolveType:	node.name.getText()
						});
						break;
					case root._importDirective:
						
						break;
				}
				return;
		}
	}
}
