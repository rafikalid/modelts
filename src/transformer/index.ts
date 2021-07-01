import { ModelKind, RootModel, ModelNode, ObjectField, ModelNodeWithChilds, ModelBaseNode, ModelMethod } from "@src/schema/model.js";
import ts, { ClassDeclaration } from "typescript";
// import treefy from 'treeify';

//FIXME
const PACKAGE_NAME= '"@src/index.js"';
/** Model pretty output */
const PRETTY= true;

/** Import tokens */
interface ImportTokens{
	tsmodel:		string
	Model:			string
	ModelScalar:	string
	UNION:			string
	ignore:			string
	assert:			string
};

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
	const mapRoots: Map<string, RootModel> = new Map();
	//* BEFORE
	function step1(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
		return function (sf: ts.SourceFile) {
			// console.log('FILE>>: ', sf.fileName)
			// Prepare root node
			const root: RootModel = {
				mapChilds:	{},
				children:	[],
				directives: {},
				modelFx:	undefined
			};
			mapRoots.set(sf.fileName, root);
			// Visit node
			return ts.visitNode(sf, _visitor(program, ctx, sf, root));
		}
	}
	//* AFTER
	function step2(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
		return function (sf: ts.SourceFile) {
			// console.log('AFTER FILE>>: ', sf.fileName)
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
	//* After
	function afterAll(ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
		return function (sf: ts.SourceFile) {
			console.log('>> AFTER ALL >> ', sf.fileName);
			function visitorCb(node: ts.Node): ts.VisitResult<ts.Node> {
				return node;
			}
			return ts.visitNode(sf, visitorCb);
		}
	}
	//* Return
	return {
		before: [step1, step2],
		after: [afterAll]
	}
}

/** Visitor */
function _visitor(program: ts.Program, ctx: ts.TransformationContext, sf: ts.SourceFile, root: RootModel): ts.Visitor {
	const factory= ctx.factory;
	const typeChecker= program.getTypeChecker();
	// Import tokens
	const importTokens: ImportTokens= {
		tsmodel:		'tsmodel',
		Model:			'Model',
		ModelScalar:	'ModelScalar',
		UNION:			'UNION',
		ignore:			'ignore',
		assert:			'assert'
	};
	/** Return visitor */
	return function(node: ts.Node){
		visiteEachChild(node, _nodeVisitor);
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
		var nodeType, nodeSymbol: ts.Symbol | undefined, currentNode: ModelNode;
		var parseDirectives: ParseDirectivesReturn;
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
				nodeType= typeChecker.getTypeAtLocation(node);
				nodeSymbol= nodeType.getSymbol();
				// jsDirectives
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
			// /** */
			// case ts.SyntaxKind:
			// 	break;
			// /** */
			// case ts.SyntaxKind:
			// 	break;
			// /** */
			// case ts.SyntaxKind:
			// 	break;
			/** By default add all childs for check */
			default:
				addVisiteNodes(node.getChildren(), undefined);
		}
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
			nodeProperties.push(
				factory.createPropertyAssignment(factory.createIdentifier("value"), factory.createIdentifier(prop.value))
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
		directives:	directives,
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
				jsDocArr.push(e.getText());
		} else {
			result.directives= undefined;
		}
		if(jsDocArr.length)
			result.jsDoc= jsDocArr.join("\n");
		// remove decorators
		if(node.decorators)
			_setDecoratorsAndModifiers(factory, node, undefined, node.modifiers);
	}catch(err){
		if(err===0 || err===2){
			// ignore using jsDoc or modifiers
			result.ignore= true;
			return result;
		} else if(err===1){
			// Remove "ignore" annotation
			_setDecoratorsAndModifiers(factory, node, node.decorators?.filter(e=> e.getText()!==ignoreToken), node.modifiers);
			// ignore using Annotation
			result.ignore= true;
			return result;
		} else {
			throw err;
		}
	}
	// Return
	return result;
}

/** Update node decorators && modifiers */
function _setDecoratorsAndModifiers(factory: ts.NodeFactory, node: ts.Node, decorators: ts.Decorator[] | undefined, modifiers: ts.ModifiersArray | undefined){
	if(ts.isClassDeclaration(node)){
		factory.updateClassDeclaration(node, decorators, modifiers, node.name, node.typeParameters, node.heritageClauses, node.members );
	} else if(ts.isMethodDeclaration(node)){
		factory.updateMethodDeclaration(node, decorators, modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, node.type, node.body);
	} else if(ts.isPropertyDeclaration(node)){
		factory.updatePropertyDeclaration(node, decorators, modifiers, node.name, node.questionToken || node.exclamationToken, node.type, node.initializer);
	} else {
		throw new Error(`Enexpected kind: ${ts.SyntaxKind[node.kind]} at ${node.getText()}:${node.getStart()}`);
	}
}