import { ModelKind, RootModel, ModelNode, ObjectField, ModelNodeWithChilds, ModelBaseNode, ImportTokens } from "@src/schema/model.js";
import ts from "typescript";
// import treefy from 'treeify';

const PACKAGE_NAME = '"tt-model"';
/** Model pretty output */
const PRETTY= true;

/** visitor signature */
type visitEachChildVisitorSignature<T>= (node: T, parentDescriptor: ModelNode|undefined, _visite: VisiteEachNodeCb<T>, addEntityToParse: (entity: ts.TypeNode)=> string)=> void
type VisiteEachNodeCb<T>= (nodes: T|undefined|(T|undefined)[], parentDescriptor: ModelNode|undefined)=> void;

/**
 * Transforme typescript interfaces and classes to Models
 */
export function createTransformer(program: ts.Program) {
	//* BEFORE
	return function(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
		return function (sf: ts.SourceFile) {
			// Prepare root node
			const root: RootModel = {
				kind:		ModelKind.ROOT,
				name:		undefined,
				jsDoc:		undefined,
				mapChilds:	{},
				children:	[],
				directives: undefined,
				_tokens:	{
					tsModel:			'tsModel',
					Model:				'Model',
					ModelScalar:		'ModelScalar',
					UNION:				'UNION',
					ignore:				'ignore',
					assert:				'assert',
					ResolversOf:		'ResolversOf',
					InputResolversOf:	'InputsOf'
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

/** Waiting queue for parsing interfaces, classes and enum */
interface wParseQueueEntry{
	node: ts.Node
	directives?: ParseDirectivesReturn
	/** Distinguish methods if are input or output resolvers */
	isInput:	boolean
}

/** Visitor */
function _astGenerate(program: ts.Program, ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel): ts.Visitor {
	const factory= ctx.factory;
	const typeChecker= program.getTypeChecker();
	// Import tokens
	const importTokens= root._tokens;
	/** Interfaces & classes parsing queue */
	const wParseQueue: wParseQueueEntry[]= [];
	/** Interfaces without explicite parsing request */
	const implicitWParseMap: Map<string, wParseQueueEntry[]>= new Map();

	/** Return visitor */
	return function(node: ts.Node){
		// Step 1: parse tree
		visiteEachChild<ts.Node>(node, _nodeVisitor);
		// Step 2: parse entities
		visiteEachChild<wParseQueueEntry>(wParseQueue, _parseEntities);
		return node;
	}

	/** get entity */
	function _getEntity(node: ts.ClassDeclaration|ts.InterfaceDeclaration|ts.EnumDeclaration, directives: ParseDirectivesReturn | undefined): ModelNode{
		if (!node.name)
			throw new Error(`Expected entity name at: ${node.getText()}:${node.getStart()}`);
		var calzzName = node.name.getText();
		// Check if has "ResolversOf" or "InputResolversOf"
		if(ts.isClassDeclaration(node) && node.heritageClauses){
			let heritageClauses= node.heritageClauses;
			rLoop: for (let i = 0, len= heritageClauses.length; i < len; i++) {
				const element = heritageClauses[i];
				let types= element.types;
				for (let j = 0, jlen= types.length; j < jlen; j++) {
					let txt= types[j].expression.getText();
					if(txt===importTokens.ResolversOf || txt===importTokens.InputResolversOf){
						calzzName= _addEntityToParse(types[j].typeArguments![0]);
						break rLoop;
					}
				}
			}
		}
		// Get from root
		var result= root.mapChilds[calzzName];
		if(!result){
			switch(node.kind){
				case ts.SyntaxKind.InterfaceDeclaration:
				case ts.SyntaxKind.ClassDeclaration:
					result = {
						name:		calzzName,
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		undefined,
						directives:	undefined,
						children:	[],
						mapChilds:	{},
						isClass:	node.kind===ts.SyntaxKind.ClassDeclaration
					};
					break;
				case ts.SyntaxKind.EnumDeclaration:
					result = {
						name:		calzzName,
						kind:		ModelKind.ENUM,
						jsDoc:		undefined,
						directives:	undefined,
						children:	[],
						mapChilds:	{}
					};
					break;
				default:
					throw new Error(`Enexpected kind`);
			}
			root.children.push(root.mapChilds[calzzName] = result);
		}
		// cirectives
		if(directives){
			if(directives.jsDoc){
				result.jsDoc= result.jsDoc? `${result.jsDoc}\n${directives.jsDoc}`: directives.jsDoc;
			}
			if(directives.directives){
				if(result.directives)
					result.directives.push(...directives.directives);
				else
					result.directives= directives.directives
			}
		}
		return result;
	}

	/** Visite each node */
	function _nodeVisitor(node: ts.Node, parentDescriptor: ModelNode|undefined, addVisiteNodes: VisiteEachNodeCb<ts.Node>){
		// get type
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
			case ts.SyntaxKind.TypeLiteral:
			case ts.SyntaxKind.EnumDeclaration:
			case ts.SyntaxKind.TypeAliasDeclaration:
				// jsDirectives
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				parseDirectives= _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol);
				if(!parseDirectives.ignore){
					// Check if has "ResolversOf" or "InputResolversOf"
					let isInput= false;
					let hasResolvers= false;
					if(ts.isClassDeclaration(node) && node.heritageClauses){
						let heritageClauses= node.heritageClauses;
						rLoop: for (let i = 0, len= heritageClauses.length; i < len; i++) {
							const element = heritageClauses[i];
							let types= element.types;
							for (let j = 0, jlen= types.length; j < jlen; j++) {
								let txt= types[j].expression.getText();
								if(txt ===  importTokens.ResolversOf){
									hasResolvers= true;
									break rLoop;
								} else if(txt=== importTokens.InputResolversOf){
									isInput= hasResolvers= true;
									break rLoop;
								}
							}
						}
					}
					// if is a model to parse
					if(hasResolvers || parseDirectives.tsModel){
						// Add to parsing queue
						wParseQueue.push({
							node:		node,
							directives:	parseDirectives,
							isInput:	isInput
						});
					} else {
						// Check for waiting parse
						let interName= (node as ts.InterfaceDeclaration).name.getText();
						let mp= implicitWParseMap.get(interName);
						if(!mp){
							mp= [];
							implicitWParseMap.set(interName, mp);
						}
						mp.push({
							node:		node as ts.InterfaceDeclaration,
							directives:	parseDirectives,
							isInput:	false
						});
					}
				}
				break;
			/** Variable statement: create new scalar, union, ... */
			case ts.SyntaxKind.VariableStatement:
				nodeType = typeChecker.getTypeAtLocation(node);
				nodeSymbol = nodeType.getSymbol();
				if(!(parseDirectives = _getDirectives(factory, typeChecker, importTokens, node, nodeSymbol)).ignore)
					deepChildOfKind(node, ts.SyntaxKind.VariableDeclaration, function(node){
						_parseModelDirective(node as ts.VariableDeclaration, root, parseDirectives);
					});
				break;
			/** By default add all childs for check */
			default:
				addVisiteNodes(node.getChildren(), undefined);
		}
	}

	/** Parse entities */
	function _parseEntities({node, directives, isInput}: wParseQueueEntry, parentDescriptor: ModelNode|undefined, addVisiteNodes: VisiteEachNodeCb<wParseQueueEntry>){
		var currentNode: ModelNode, nodeType;
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				// jsDirectives
				nodeType = typeChecker.getTypeAtLocation(node);
				currentNode= _getEntity(node as ts.InterfaceDeclaration, directives);
				// Parse each property
				nodeType.getProperties().forEach(function({valueDeclaration}){
					if(valueDeclaration)
						addVisiteNodes({node: valueDeclaration, isInput}, currentNode);
				});
				break;
			/** Enumeration */
			case ts.SyntaxKind.EnumDeclaration:
				// jsDirectives
				// nodeType = typeChecker.getTypeAtLocation(node);
				// current node
				currentNode= _getEntity(node as ts.EnumDeclaration, directives);
				// Go through each child
				node.getChildren().forEach(function(e){
					addVisiteNodes({node: e, isInput}, currentNode);
				});
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
			/** Property signature */
			case ts.SyntaxKind.PropertySignature:
				// nodeType = typeChecker.getTypeAtLocation(node);
				if(parentDescriptor){
					if (parentDescriptor.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ModelKind[parentDescriptor.kind]} at ${node.getText()}`);
					// Current node
					currentNode = {
						kind:		ModelKind.FIELD,
						name:		(node as ts.PropertySignature).name.getText(),
						jsDoc:		directives?.jsDoc,
						directives:	directives?.directives,
						required:	!(node as ts.PropertySignature).questionToken,
						children:	[],
						resolver:	undefined,
						input:		undefined
					};
					// Add to parent
					parentDescriptor.children.push(parentDescriptor.mapChilds[currentNode.name!] = currentNode);
					// Go through childs
					node.getChildren().forEach(function(e){
						addVisiteNodes({node: e, isInput}, currentNode);
					});
				}
				break;
			
			/** Method declaration */
			case ts.SyntaxKind.MethodDeclaration:
				// nodeType = typeChecker.getTypeAtLocation(node);
				if(parentDescriptor){
					if (parentDescriptor.kind !== ModelKind.PLAIN_OBJECT)
						throw new Error(`Expected parent node to be interface or class, got ${ModelKind[parentDescriptor.kind]} at ${node.getText()}`);
					// resolver
					let resolverMethod: ObjectField['resolver']= undefined;
					let inputResolver: ObjectField['input']= undefined;
					let methodName= (node as ts.MethodDeclaration).name.getText();
					if(isInput){
						inputResolver= `${parentDescriptor.name}.prototype.${methodName}`;
					} else {
						resolverMethod= {
							kind:		ModelKind.METHOD,
							name:		methodName,
							jsDoc:		directives?.jsDoc,
							directives:	directives?.directives,
							// method:		node as ts.MethodDeclaration,
							method: `${parentDescriptor.name}.prototype.${methodName}`,
							/** [ResultType, ParamType] */
							children:	[undefined, undefined],
						};
					}
					// Current node
					currentNode = {
						kind:		ModelKind.FIELD,
						name:		methodName,
						jsDoc:		directives?.jsDoc,
						directives:	directives?.directives,
						required:	!(node as ts.MethodDeclaration).questionToken,
						children:	[],
						resolver:	resolverMethod,
						input:		inputResolver
					};
					// Add to parent
					parentDescriptor.children.push(parentDescriptor.mapChilds[currentNode.name!] = currentNode);
					// Go trough childs
					let nNode= resolverMethod||currentNode
					node.getChildren().forEach(function(e){
						addVisiteNodes({node: e, isInput}, nNode);
					});
					// Go through arg param
					if(!isInput){
						var params = (node as ts.MethodDeclaration).parameters;
						if (params && params[1])
							addVisiteNodes({node: params[1], isInput}, resolverMethod);
					}
				}
				break;
			/** Enum member */
			case ts.SyntaxKind.EnumMember:
				// nodeType = typeChecker.getTypeAtLocation(node);
				if (parentDescriptor) {
					if (parentDescriptor.kind !== ModelKind.ENUM)
						throw new Error(`Expected parent node to ENUM, got ${ts.SyntaxKind[node.kind]} at ${node.getStart()}`);
					// Current node
					currentNode = {
						kind:		ModelKind.ENUM_MEMBER,
						name:		(node as ts.PropertySignature).name.getText(),
						jsDoc:		directives?.jsDoc,
						directives:	directives?.directives,
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
				// nodeType = typeChecker.getTypeAtLocation(node);
				console.log('----------------------------------------->> TYPE: ');
				break;
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
		}
	}

	/** Custom visitor process */
	function visiteEachChild<T>(node: T|T[], visitor: visitEachChildVisitorSignature<T>){
		const nodeQueue: T[]= Array.isArray(node)? node : [node];
		const parentQueue: (ModelNode|undefined)[]= Array(nodeQueue.length).fill(undefined);
		var i= 0, len= nodeQueue.length;
		function _visite(nodes: T|undefined|(T|undefined)[], parentDescriptor: ModelNode|undefined){
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
			visitor(nodeQueue[i], parentQueue[i], _visite, _addEntityToParse);
			++i;
		}

		/** Add entity to parse */
		function _addEntityToParse(entity: ts.TypeNode): string{
			var entityName= entity.getText()!;
			var entityType: ts.Type, declaration: ts.Declaration | undefined;
			console.log('--- add entity: ', entityName)
			var entityType: ts.Type, declarations: ts.Declaration[] | undefined;
			if((entityType= typeChecker.getTypeAtLocation(entity)) && (declarations= entityType.getSymbol()?.declarations)){
				if(declarations.length===1){
					console.log('dec---:', declarations[0].getText())
					_visite({node: declarations[0], isInput: false}, undefined); ///------------------- here
				} else {
					console.log('--- Enexpected declarations!')
				}
			}
			return entityName;
		}
	}
}

/** Insert AST */
function _astVisitor(program: ts.Program, ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel){
	const factory= ctx.factory;
	const importTokens= root._tokens;
	const ignoreToken= `@${importTokens.ignore}`;
	const tsModelToken= `@${importTokens.tsModel}`;
	const assertToken= `@${importTokens.assert}`;
	const modelToken= importTokens.Model;
	return function(node: ts.Node){
		if(root.children.length)
			node= ts.visitEachChild(node, _visitor, ctx);
		return node;
	}
	/** Visitor */
	function _visitor(node: ts.Node): ts.Node{
		if(ts.isNewExpression(node)){
			if(node.expression.getText()===modelToken){
				//* Model new Object
				node= factory.createNewExpression(
					node.expression,
					node.typeArguments,
					[_serializeAST(root, ctx.factory)]
				);
			}
		} else {
			//* CLEAR DECORATORS
			let decorators= node.decorators;
			if(decorators){
				let filteredDecorators= decorators.filter(function(e){
					var t= e.getText();
					return t!== ignoreToken && t!== tsModelToken && t!== assertToken
				});
				if(filteredDecorators.length != decorators.length){
					if(ts.isClassDeclaration(node)){
						node= factory.createClassDeclaration(filteredDecorators, node.modifiers, node.name, node.typeParameters, node.heritageClauses, node.members);
					} else if(ts.isMethodDeclaration(node)){
						node= factory.createMethodDeclaration(filteredDecorators, node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type, node.body);
					} else if(ts.isPropertyDeclaration(node)){
						node= factory.createPropertyDeclaration(filteredDecorators, node.modifiers, node.name, node.questionToken || node.exclamationToken, node.type, node.initializer);
					} else {
						console.warn(`---- unsupported kind: ${ts.SyntaxKind[node.kind]}`);
					}
				}
			}
			//* Visit each child
			node= ts.visitEachChild(node, _visitor, ctx);
		}
		return node;
	}
}

/** Serialize AST */
function _serializeAST<T extends ModelNode|RootModel>(root: T, factory: ts.NodeFactory): ts.ObjectLiteralExpression{
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
					factory.createPropertyAssignment(factory.createIdentifier("parser"), node.parser)
				);
				break;
			case ModelKind.UNION:
				nodeProperties.push(
					factory.createPropertyAssignment(factory.createIdentifier("resolveType"), node.resolveType)
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

/** Child child with a kind */
function deepChildOfKind<T extends ts.Node>(node: ts.Node, kind: ts.SyntaxKind, cb: (node: T)=>void){
	var queue= [node];
	var i=0, len= queue.length;
	while(i<len){
		node= queue[i++];
		if(node.kind===kind)
			cb(node as T);
		else {
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
	const tsModelToken=	importTokens.tsModel;
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
		// jsDoc
		var jsDocArr= [];
		var jsDocEl;
		if(nodeSymbol && (jsDocEl= nodeSymbol.getDocumentationComment(typeChecker)).length){
			for(let e of jsDocEl)
				jsDocArr.push(e.text);
		}
		// Load from JsDoc
		if(childs= nodeSymbol?.getJsDocTags()){
			len= childs.length;
			for(i=0; i<len; ++i){
				child= childs[i];
				dName= child.name;
				let childText= child.text? `${dName}(${child.text.map(e=> e.text).join("\n")}` : dName;
				jsDocArr.push(`@${childText}`); // jsDoc
				switch(dName){
					case assertToken:
						directives.push(childText);
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
							directives.push(expression.getText());
							break;
						case tsModelToken:
							result.tsModel= true;
							break;
						case ignoreToken:
							throw 1;
					}
					jsDocArr.push(`@${expression.getText()}`); // jsDoc
				}
			}
		}
		//-
		if(directives.length)
			result.directives= directives;
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
