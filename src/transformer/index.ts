import { ModelKind, RootModel, ModelNode, ObjectField, ModelNodeWithChilds, ModelBaseNode, ImportTokens } from "@src/schema/model.js";
import ts from "typescript";
// import treefy from 'treeify';

const PACKAGE_NAME = '"typesript-model"';
/** Model pretty output */
const PRETTY= true;

/** visitor signature */
type visitEachChildVisitorSignature= (node: ts.Node, parentDescriptor: ModelNode|undefined, _visite: VisiteEachNodeCb)=> void
type VisiteEachNodeCb= (nodes: ts.Node|undefined|(ts.Node|undefined)[], parentDescriptor: ModelNode|undefined)=> void;
/** Custom visitor process */
function visiteEachChild(node: ts.Node, visitor: visitEachChildVisitorSignature){
	const nodeQueue: ts.Node[]= [node];
	const parentQueue: (ModelNode|undefined)[]= [undefined];
	var i= 0, len= nodeQueue.length;
	function _visite(nodes: ts.Node|undefined|(ts.Node|undefined)[], parentDescriptor: ModelNode|undefined){
		if(Array.isArray(nodes)){
			var j, jLen;
			for(j=0, jLen= nodes.length; j<jLen; ++j){
				if(nodes[j]!=null){
					nodeQueue.push(nodes[j]!);
					parentQueue.push(parentDescriptor)
				}
			}
		} else if(nodes) {
			nodeQueue.push(nodes);
			parentQueue.push(parentDescriptor)
		}
		// Update lenght
		len= nodeQueue.length;
	}
	while(i<len){
		visitor(nodeQueue[i], parentQueue[i], _visite);
		++i;
	}
}

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createTransformer(program: ts.Program) {
	//* BEFORE
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
		return function (sf: ts.SourceFile) {
			// console.log('FILE>>: ', sf.fileName)
			// Prepare root node
			const root: RootModel = {
				mapChilds:	{},
				children:	[],
				directives: {},
				_tokens:	{
					tsmodel:		'tsmodel',
					Model:			'Model',
					ModelScalar:	'ModelScalar',
					UNION:			'UNION',
					ignore:			'ignore',
					assert:			'assert'
				}
			};
			// Step 1: Generate AST
			sf= ts.visitNode(sf, _astGenerate(program, ctx, sf, root));
			// Step 2: Insert AST
			sf= ts.visitNode(sf, _astVisitor(program, ctx, sf, root));
			return sf;
		}
	}
}

/** Visitor */
function _astGenerate(program: ts.Program, ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel): ts.Visitor {
	const factory= ctx.factory;
	const typeChecker= program.getTypeChecker();
	// Import tokens
	const importTokens= root._tokens;
	/** Return visitor */
	return function(node: ts.Node){
		// Step 1: compile tree
		console.log('------<Step 1>-----')
		visiteEachChild(node, _nodeVisitor);
		console.log('------<Step 2>-----')
		// Step 3: 
		return node;
	}

	/** Add entity */
	function _addEntity(entity: ModelNode, node: ts.Node) {
		var calzzName = entity.name;
		if (!calzzName)
			throw new Error(`Expected entity name at: ${node.getStart()}`);
		if (root.mapChilds[calzzName])
			throw new Error(`Duplicated entity name: ${calzzName}`);
		root.children.push(root.mapChilds[calzzName] = entity);
	}
	

	/** Visite each node */
	function _nodeVisitor(node: ts.Node, parentDescriptor: ModelNode|undefined, addVisiteNodes: VisiteEachNodeCb){
		// get type
		var currentNode: ModelNode;
		var parseDirectives: ParseDirectivesReturn;
		var nodeType;
		var nodeSymbol;
		// Switch kind
		switch(node.kind){
			/** parse Imports */
			case ts.SyntaxKind.ImportDeclaration:
				if((node as ts.ImportDeclaration).moduleSpecifier.getText()===PACKAGE_NAME){
					deepChildOfKind(node, ts.SyntaxKind.ImportSpecifier, function(n: ts.ImportSpecifier){
						var tName= n.getFirstToken()?.getText();
						var tValue= n.getLastToken()?.getText();
						if(tName && importTokens.hasOwnProperty(tName))
							//@ts-ignore
							importTokens[tName]= tValue;
					});
				}
				break;
			/** Class && interfaces */
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				// jsDirectives
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				parseDirectives= _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				if(!parseDirectives.ignore && (parseDirectives.tsModel || parentDescriptor)){
					// node descriptor
					currentNode = {
						name:		(node as any).name?.getText(),
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		parseDirectives.jsDoc,
						directives:	parseDirectives.directives,
						children:	[],
						mapChilds:	{},
						isClass:	nodeType.isClass()
					};
					// Parse each property
					addVisiteNodes(nodeType.getProperties().map(s=> s.valueDeclaration), currentNode);
					// Add entity
					if(parentDescriptor)
						(parentDescriptor as ObjectField).children.push(currentNode);
					else
						_addEntity(currentNode, node);
				}
				break;
			/** Type literal */
			case ts.SyntaxKind.TypeLiteral:
				if(parentDescriptor){
					currentNode = {
						name:		(node as any).name?.getText(),
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		undefined,
						directives:	undefined,
						children:	[],
						mapChilds:	{},
						isClass:	false
					};
					(parentDescriptor as ObjectField).children.push(currentNode);
				}
				break;
			/** Enumeration */
			case ts.SyntaxKind.EnumDeclaration:
				// jsDirectives
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				if (parseDirectives.tsModel && !parseDirectives.ignore){
					// current node
					currentNode = {
						name:		(node as ts.EnumDeclaration).name?.getText(),
						kind:		ModelKind.ENUM,
						jsDoc:		parseDirectives.jsDoc,
						directives:	parseDirectives.directives,
						children:	[],
						mapChilds:	{}
					};
					if(parentDescriptor)
						(parentDescriptor as ObjectField).children.push(currentNode);
					else
						_addEntity(currentNode, node);
					// Go through each child
					addVisiteNodes(node.getChildren(), currentNode);
				}
				break;
			/** Property signature */
			case ts.SyntaxKind.PropertySignature:
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				if(parentDescriptor && !(parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol)).ignore){
					if (parentDescriptor.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					// Current node
					currentNode = {
						kind:		ModelKind.FIELD,
						name:		(node as ts.PropertySignature).name.getText(),
						jsDoc:		parseDirectives.jsDoc,
						directives:	parseDirectives.directives,
						required:	!(node as ts.PropertySignature).questionToken,
						children:	[]
					};
					// Add to parent
					parentDescriptor.children.push(parentDescriptor.mapChilds[currentNode.name!] = currentNode);
					// Go through childs
					addVisiteNodes(node.getChildren(), currentNode);
				}
				break;
			/** Enum member */
			case ts.SyntaxKind.EnumMember:
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				if (parentDescriptor && !(parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol)).ignore) {
					if (parentDescriptor.kind !== ModelKind.ENUM)
						throw new Error(`Expected parent node to ENUM, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					// Current node
					currentNode = {
						kind:		ModelKind.ENUM_MEMBER,
						name:		(node as ts.PropertySignature).name.getText(),
						jsDoc:		parseDirectives.jsDoc,
						directives:	parseDirectives.directives,
						required:	true,
						value:		(function(){
							var i, len, childs= node.getChildren();
							for(i=0, len=childs.length; i<len; ++i){
								if (childs[i].kind === ts.SyntaxKind.FirstAssignment){
									return childs[i + 1].getText()
								}
							}
						})()
					};
				}
				break;
			/** Type */
			case ts.SyntaxKind.TypeAliasDeclaration:
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				if (parseDirectives.tsModel && !parseDirectives.ignore) {
					console.log('----------------------------------------->> TYPE: ');
				}
				break;
			// /** */
			// case ts.SyntaxKind:
			// 	break;
			//* Basic Types
			case ts.SyntaxKind.TypeReference:
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
				if(parentDescriptor){
					switch (parentDescriptor.kind) {
						case ModelKind.FIELD:
						case ModelKind.LIST:
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentDescriptor.children[0] = {
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
				break;
			/** Array type */
			case ts.SyntaxKind.ArrayType:
				if(parentDescriptor){
					currentNode = {
						kind:	ModelKind.LIST,
						name:	undefined,
						jsDoc:	undefined,
						directives:	undefined,
						children: []
					}
					switch (parentDescriptor.kind) {
						case ModelKind.FIELD:
						case ModelKind.LIST:
						case ModelKind.METHOD:
						case ModelKind.PARAM:
							parentDescriptor.children[0] = currentNode;
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
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				if(parentDescriptor && !(parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol)).ignore){
					if (parentDescriptor.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ts.SyntaxKind[node.kind]} at ${node.getText()}: ${node.getStart()}`);
					var methodName= (node as ts.MethodDeclaration).name.getText();
					currentNode = {
						kind:		ModelKind.METHOD,
						name:		methodName,
						jsDoc:		parseDirectives.jsDoc,
						directives:	parseDirectives.directives,
						// method:		node as ts.MethodDeclaration,
						method: `${parentDescriptor.name}.prototype.${methodName}`,
						/** [ResultType, ParamType] */
						children:	[undefined, undefined],
					};
					// Append to parent
					parentDescriptor.children.push(parentDescriptor.mapChilds[currentNode.name!] = currentNode);
					// Go trough childs
					addVisiteNodes(node.getChildren(), currentNode);
					// Go through arg param
					var params = (node as ts.MethodDeclaration).parameters;
					if (params && params[1])
						addVisiteNodes(params[1], currentNode);
					return node;
				}
				break;
			/** Method param */
			case ts.SyntaxKind.Parameter:
				if(parentDescriptor){
					if (parentDescriptor.kind !== ModelKind.METHOD)
						throw new Error(`Enexpected param access at ${node.getText()}:${node.getStart()}`);
					currentNode = {
						kind: ModelKind.PARAM,
						name: (node as ts.ParameterDeclaration).name.getText(),
						jsDoc: undefined,
						directives:	undefined,
						children: []
					};
					parentDescriptor.children[1] = currentNode;
				}
				break;
			/** Variable statement: create new scalar, union, ... */
			case ts.SyntaxKind.VariableDeclaration:
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				if(!(parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol)).ignore)
					_parseModelDirective(node as ts.VariableDeclaration, root, parseDirectives);
				break;
			/** By default add all childs for check */
			default:
				addVisiteNodes(node.getChildren(), undefined);
		}
	}
}

/** Insert AST */
function _astVisitor(program: ts.Program, ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel){
	const factory= ctx.factory;
	const typeChecker= program.getTypeChecker();
	const importTokens= root._tokens;
	const ignoreToken= `@${importTokens.ignore}`;
	return function(node: ts.Node){
		if(root.children.length)
			node= ts.visitEachChild(node, _visitor, ctx);
		return node;
	}
	/** Visitor */
	function _visitor(node: ts.Node): ts.Node{
		if(ts.isNewExpression(node)){
			//* Model new Object
			node= factory.createNewExpression(
				node.expression,
				node.typeArguments,
				[_serializeAST(root, ctx)]
			);
		} else {
			//* CLEAR DECORATORS
			let kind= node.kind;
			if(kind===ts.SyntaxKind.PropertyDeclaration || kind===ts.SyntaxKind.MethodDeclaration){
				let nodeType = typeChecker.getTypeAtLocation(node);
				let nodeSymbol = nodeType.getSymbol();
				let parseDirectives= _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				let decorators= undefined;
				if(parseDirectives.ignore)
					decorators= node.decorators?.filter(e=> e.getText()!==ignoreToken);
				if(ts.isMethodDeclaration(node)){
					node= factory.createMethodDeclaration(decorators, node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type, node.body);
				} else if(ts.isPropertyDeclaration(node)){
					node= factory.createPropertyDeclaration(decorators, node.modifiers, node.name, node.questionToken || node.exclamationToken, node.type, node.initializer);
				}
				//* Visit each child
				node= ts.visitEachChild(node, _visitor, ctx);
			} else if(ts.isClassDeclaration(node)){
				let nodeType = typeChecker.getTypeAtLocation(node);
				let nodeSymbol = nodeType.getSymbol();
				let parseDirectives= _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				if(parseDirectives.tsModel){
					node= factory.createClassDeclaration(undefined, node.modifiers, node.name, node.typeParameters, node.heritageClauses, node.members );
					//* Visit each child
					node= ts.visitEachChild(node, _visitor, ctx);
				}
			} else {
				//* Visit each child
				node= ts.visitEachChild(node, _visitor, ctx);
			}
		}
		return node;
	}
}

/** Common AST serialize */
function _astSerializeCommon(factory:ts.NodeFactory, prop: ModelNode){
	var nodeProperties: ts.ObjectLiteralElementLike[]= [
		factory.createPropertyAssignment( factory.createIdentifier("name"), prop.name==null? factory.createIdentifier("undefined") : factory.createStringLiteral(prop.name)),
		factory.createPropertyAssignment( factory.createIdentifier("kind"), factory.createNumericLiteral(prop.kind)),
		factory.createPropertyAssignment( factory.createIdentifier("jsDoc"), prop.jsDoc==null? factory.createIdentifier("undefined") : factory.createStringLiteral(prop.jsDoc)),
		factory.createPropertyAssignment(
			factory.createIdentifier("directives"),
			prop.directives==null?
				factory.createIdentifier("undefined")
				: factory.createArrayLiteralExpression(prop.directives, PRETTY)
		)
	]
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
			// var method= prop.method;
			// nodeProperties.push(
			// 	factory.createMethodDeclaration(
			// 		undefined, //method.decorators,
			// 		undefined, //method.modifiers,
			// 		undefined,
			// 		'method',
			// 		undefined,
			// 		undefined,
			// 		method.parameters,
			// 		undefined,
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
		case ModelKind.ENUM_MEMBER:
			nodeProperties.push(
				factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createIdentifier(prop.value ?? "undefined"))
			);
			break;
		case ModelKind.SCALAR:
			nodeProperties.push(
				factory.createPropertyAssignment(factory.createIdentifier("parser"), prop.parser)
			);
			break;
		case ModelKind.UNION:
			nodeProperties.push(
				factory.createPropertyAssignment(factory.createIdentifier("resolveType"), prop.resolveType)
			);
			break;
		case ModelKind.DIRECTIVE:
			nodeProperties.push(
				factory.createPropertyAssignment( factory.createIdentifier("resolver"), prop.resolver)
			);
	}
	return nodeProperties;
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
				var nodeProperties: ts.ObjectLiteralElementLike[]= _astSerializeCommon(factory, prop);
				// Add children
				if((prop as ModelNodeWithChilds).children){
					fields= [];
					nodeProperties.push(
						factory.createPropertyAssignment(
							factory.createIdentifier("children"),
							factory.createArrayLiteralExpression( fields, PRETTY )
						)
					);
					queue.push((prop as ModelNodeWithChilds).children);
					results.push(fields);
				}
				// Add to parent
				fieldNodes.push(factory.createObjectLiteralExpression(nodeProperties, PRETTY));
			} else {
				fieldNodes.push(factory.createIdentifier('undefined'));
			}
	}
	//* Directives
	const directiveFields=[];
	const directives= root.directives;
	for(let k in directives) if(typeof k === 'string' && directives.hasOwnProperty(k)){
		prop= directives[k];
		directiveFields.push(factory.createPropertyAssignment(
			factory.createIdentifier(k),
			factory.createObjectLiteralExpression(_astSerializeCommon(factory, prop), PRETTY)
		));
	}
	//* RETURN
	return factory.createObjectLiteralExpression([
		//Models
		factory.createPropertyAssignment(
			factory.createIdentifier("children"),
			factory.createArrayLiteralExpression( results[0], PRETTY )
		),
		// directives
		factory.createPropertyAssignment(
			factory.createIdentifier("directives"),
			factory.createObjectLiteralExpression(directiveFields, PRETTY)
		)
	], PRETTY);
	//return ctx.factory.createIdentifier(JSON.stringify(root));
}

/** Child child with a kind */
function deepChildOfKind<T extends ts.Node>(node: ts.Node, kind: ts.SyntaxKind, cb: (node: T)=>void){
	var queue= [node];
	var i=0, len= queue.length;
	while(i<len){
		node= queue[i++];
		if(node.kind===kind)
			cb(node as T);
		else{
			var childs= node.getChildren();
			var j, jLen= childs.length;
			for(j=0; j<jLen; ++j){
				queue.push(childs[j]);
			}
			len= queue.length;
		}
	}
}
/** Parse directives return */
interface ParseDirectivesReturn{
	ignore: boolean
	tsModel: boolean
	directives: ModelBaseNode['directives'],
	jsDoc:	string|undefined
}
/** Parse directives */
function _getDirectives(factory: ts.NodeFactory, typeChecker: ts.TypeChecker, importTokens: ImportTokens, node: ts.Node, nodeSymbol: ts.Symbol | undefined): ParseDirectivesReturn{
	var directives: ModelBaseNode['directives']= [];
	var i, len, child, childs, expression: ts.Expression|undefined, dName: string;
	const ignoreToken=	importTokens.ignore;
	const assertToken=	importTokens.assert;
	const tsModelToken=	importTokens.tsmodel;
	// result
	const result: ParseDirectivesReturn= {
		ignore:		false,
		tsModel:	false,
		directives:	undefined,
		jsDoc:		undefined
	}
	try{
		// Check if ignore based on modifiers
		if(node.modifiers){
			for(let e of node.modifiers){
				let n= e.getText();
				if(n==='private' || n==='protected')
					throw 2;
			}
		}
		// Load from JsDoc
		if(childs= nodeSymbol?.getJsDocTags()){
			len= childs.length;
			for(i=0; i<len; ++i){
				child= childs[i];
				dName= child.name;
				switch(dName){
					case assertToken:
						directives.push(factory.createIdentifier(child.text? `${dName}(${child.text.map(e=> e.text).join("\n")}` : dName));
						break;
					case tsModelToken:
						result.tsModel= true;
						break;
					case ignoreToken:
						throw 0;
				}
			}
		}
		// Load from annotations
		if(childs= node.decorators){
			rtLoop: for(i=0, len=childs.length; i<len; ++i){
				child= childs[i];
				expression= child.getChildren().find(e=> e.kind=== ts.SyntaxKind.CallExpression || e.kind === ts.SyntaxKind.Identifier) as ts.Expression;
				if(expression){
					switch(expression.kind){
						case ts.SyntaxKind.Identifier:
							dName= expression.getText();
							break;
						case ts.SyntaxKind.CallExpression:
							dName= expression.getFirstToken()!.getText();
							break;
						default:
							continue rtLoop;
					}
					switch(dName){
						case assertToken:
							directives.push(expression);
							break;
						case tsModelToken:
							result.tsModel= true;
							break;
						case ignoreToken:
							throw 1;
					}
				}
			}
		}
		// jsDoc
		var jsDocArr= [];
		var jsDocEl;
		if(nodeSymbol && (jsDocEl= nodeSymbol.getDocumentationComment(typeChecker)).length){
			for(let e of jsDocEl)
				jsDocArr.push(e.text);
		}
		if(directives.length){
			for(let e of directives)
				jsDocArr.push(`@${e.getText()}`);
			result.directives= directives;
		}
		if(jsDocArr.length)
			result.jsDoc= jsDocArr.join("\n");
	}catch(err){
		if(err===0 || err=== 1 || err===2){
			// ignore using jsDoc, decorator or modifiers
			result.ignore= true;
		} else {
			throw err;
		}
	}
	// Return
	return result;
}
/** Parse scalars, unions and directives */
function _parseModelDirective(node: ts.VariableDeclaration, root: RootModel, parseDirectives: ParseDirectivesReturn) {
	// Get type reference and syntax list
	const importTokens= root._tokens;
	const childs= node.getChildren();
	const typeRefChild= childs.find(e=> e.kind===ts.SyntaxKind.TypeReference);
	// Get object literal
	const objLiteralChild= childs.find(e=> e.kind===ts.SyntaxKind.ObjectLiteralExpression) as ts.ObjectLiteralExpression;
	// Do checks
	if(typeRefChild && objLiteralChild ){
		const typeRefName= typeRefChild.getFirstToken()!.getText();
		const syntaxList= typeRefChild.getChildren().find(e=>e.kind===ts.SyntaxKind.SyntaxList) as ts.SyntaxList|undefined;
		var element;
		// switch
		switch(typeRefName){
			case importTokens.ModelScalar:
				if(!syntaxList)
					throw new Error(`Expected generic type at: ${node.getText()}:${node.getStart()}`);
				var nodeName= syntaxList.getText();
				if(!/^[a-z_]+$/i.test(nodeName))
					throw new Error(`Enexprected scalar name: "${nodeName}" at ${typeRefChild.getText()}:${typeRefChild.getStart()}`);
				if(root.mapChilds[nodeName])
					throw new Error(`Already defined entity ${nodeName} at ${objLiteralChild.getText()}: ${objLiteralChild.getStart()}`);
				root.children.push(element= root.mapChilds[nodeName]={
					kind:		ModelKind.SCALAR,
					name:		nodeName,
					jsDoc:		parseDirectives.jsDoc,
					directives:	parseDirectives.directives,
					parser:		objLiteralChild
				});
				break;
			case importTokens.UNION:
				// Unions
				nodeName= node.name.getText();
				if(root.mapChilds[nodeName])
					throw new Error(`Already defined entity ${nodeName} at ${typeRefChild.getText()}: ${typeRefChild.getStart()}`);
				//FIXME parse union types
				root.children.push(element= root.mapChilds[nodeName]={
					kind:			ModelKind.UNION,
					name:			nodeName,
					jsDoc:			parseDirectives.jsDoc,
					directives:		parseDirectives.directives,
					resolveType:	objLiteralChild
				});
				break;
		}
	}
}
