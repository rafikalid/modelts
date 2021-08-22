import { ModelKind, ModelNode, ModelRoot, ObjectField, ModelObjectNode, ModelRefNode, ModelNodeWithChilds, ModelUnionNode, MethodDescriptor, ModelMethod } from "@src/schema/model";
import ts from "typescript";
import Glob from 'glob';
import { Visitor } from "@src/utils/utils";
import { DEFAULT_SCALARS } from "@src/schema/types";
import { AssertOptions } from "@src/model/decorators";
import JSON5 from 'json5';
const {parse: parseJSON}= JSON5;

/** Parse Model from files */
export function ParseModelFrom(pathPattern:string, compilerOptions: ts.CompilerOptions): ModelRoot{
	/** Root node */
	const root: ModelRoot= {
		kind: ModelKind.ROOT,
		name: undefined,
		jsDoc: undefined,
		deprecated: undefined,
		children: [],
		mapChilds: {}
	}
	const mapEntities= root.mapChilds;
	const entities= root.children;
	const result: ModelRoot= root;
	//* Load files using glob
	const files= Glob.sync(pathPattern);
	if (files.length === 0){
		console.warn(`No file found for pattern: ${pathPattern}`);
		return result;
	}
	//* Create compiler host
	const pHost= ts.createCompilerHost(compilerOptions, true); 
	//* Create program
	const program= ts.createProgram(files, compilerOptions, pHost);
	const typeChecker= program.getTypeChecker();
	// const referenceMap: Map<string, ts.TypeReferenceNode>= new Map();

	//* STEP 1: RESOLVE SCALARS, UNIONS, RESOLVERS AND INPUT_RESOLVERS
	const visitor0= new Visitor<ts.Node>();
	/** Step 3 visitor */
	const visitor= new Visitor<ts.Node>();
	var srcFiles= program.getSourceFiles();
	const resolversMapping: Map<ts.ClassDeclaration|ts.InterfaceDeclaration, ResolverFields>= new Map();
	for(let i=0, len=srcFiles.length; i<len; ++i){
		let srcFile= srcFiles[i];
		if(srcFile.isDeclarationFile) continue;
		// Push to iterator
		visitor0.push(srcFile.getChildren(), undefined, false, undefined, undefined);
		visitor.push(srcFile.getChildren(), undefined, false, undefined, undefined);
	}
	var it= visitor0.it();
	while(true){
		// get next item
		let item= it.next();
		if(item.done) break;
		// ndoe
		let {node, parentDescriptor: pDesc, isInput, generics}= item.value;
		let fileName= node.getSourceFile().fileName;
		if(ts.isClassDeclaration(node) && node.heritageClauses){
			//* ResolversOf, InputResolversOf
			if(node.name==null) continue;
			let resolverNode: ts.TypeReferenceNode|undefined;
			node.heritageClauses.some(n=> n.types.some(function(t){
				var s= typeChecker.getSymbolAtLocation(t.expression);
				var txt= s?.name;
				if(txt==='ResolversOf' || txt==='InputResolversOf'){
					resolverNode= t.typeArguments![0] as ts.TypeReferenceNode;
					isInput= txt==='InputResolversOf';
					return true;
				}
			}));
			if(resolverNode==null) continue;
			let className= node.name.getText();
			// Check has "export" keyword
			if(!(node.modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword)))
				throw new Error(`Expected "export" keyword on class "${className}" at ${fileName}`);
			// Load target interface node
			let targetInterface= typeChecker.getAliasedSymbol(
				typeChecker.getSymbolAtLocation(resolverNode.typeName)!
			)?.declarations?.[0] as ts.InterfaceDeclaration;
			if(targetInterface==null)
				throw new Error(`Fail to resolve reference: ${resolverNode.getText()} at ${fileName}`);
			// prepare fields
			let fieldsMap: ResolverFields|undefined= resolversMapping.get(targetInterface);
			if(fieldsMap==null){
				fieldsMap= new Map();
				resolversMapping.set(targetInterface, fieldsMap);
			}
			let childs= typeChecker.getTypeAtLocation(node).getProperties();
			// let childs= node.getChildren();
			for(let j=0, jlen= childs.length; j<jlen; j++){
				let child= childs[j].valueDeclaration;
				if(child==null) continue;
				if(ts.isMethodDeclaration(child)){
					let methodName= child.name.getText();
					let d= fieldsMap.get(methodName);
					if(d==null){
						d= {};
						fieldsMap.set(methodName, d);
					}
					let di: MethodDescriptor= {
						fileName,
						className,
						name: methodName,
						isStatic: child.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
					};
					if(isInput){
						if(d.input==null) d.input= di;
						else throw new Error(`Input resolver already defined to "${className}.${methodName}" at: ${fileName}`);
					} else {
						if(d.output==null){
							d.output= {
								kind:		ModelKind.METHOD,
								name:		methodName,
								jsDoc:		undefined,
								deprecated: undefined,
								// method:		node as ts.MethodDeclaration,
								method:		di,
								// method: `${parentDescriptor.oName??parentDescriptor.name}.prototype.${methodName}`,
								/** [ResultType, ParamType] */
								children:	[undefined, undefined]
							};
							// Resolve Param type
							let params = child.parameters;
							if (params && params[1])
								visitor.push(params[1], d.output, isInput, generics, undefined);
							// Resolve return value
							visitor.push(
								child.type
								?? (typeChecker.getReturnTypeOfSignature(typeChecker.getSignatureFromDeclaration(child)!).symbol?.declarations?.[0])
								, d.output, isInput, generics, undefined);
						} else throw new Error(`Resolver already defined to "${className}.${methodName}" at: ${fileName}`);
					}
				}
			}
		} else if(ts.isVariableStatement(node)){
			//* Scalars, Union
			let meta= _getNodeMetadata(node, typeChecker);
			if(meta.ignore) continue;
			let declarations= node.declarationList.declarations;
			for(let j=0, jlen=declarations.length; j<jlen; ++j){
				let declaration= declarations[j];
				let type= declaration.type;
				let nodeName= declaration.name.getText();
				let s: ts.Symbol | undefined;
				if(
					type
					&& ts.isTypeReferenceNode(type)
					&& type.typeArguments?.length===1
					&& (s= typeChecker.getSymbolAtLocation(type.typeName))
				){
					let typeArg= type.typeArguments[0];
					let fieldName= typeArg.getText();
					switch(s.name){
						case 'ModelScalar':
							//* Scalar
							if(!ts.isTypeReferenceNode(typeArg))
								throw new Error(`Enexpected scalar name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
							if(mapEntities[fieldName])
								throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
							entities.push(mapEntities[fieldName]={
								kind:		ModelKind.SCALAR,
								name:		fieldName,
								jsDoc:		meta.jsDoc,
								deprecated: meta.deprecated,
								parser:		{
									fileName:	node.getSourceFile().fileName,
									className:	nodeName,
									isStatic:	true,
									name:		undefined
								}
							});
							break;
						case 'UNION':
							//* UNION
							if(!ts.isTypeReferenceNode(typeArg))
								throw new Error(`Enexpected UNION name: "${fieldName}" at ${fileName}::${typeArg.getStart()}`);
							if(mapEntities[fieldName])
								throw new Error(`Already defined entity ${fieldName} at ${fileName}: ${typeArg.getStart()}`);
							let currentNode: ModelNode= {
								kind:		ModelKind.UNION,
								name:		fieldName,
								jsDoc:		meta.jsDoc,
								deprecated: meta.deprecated,
								children:	[],
								parser:		{
									fileName:	fileName,
									className:	nodeName,
									isStatic:	true,
									name:		undefined
								}
							};
							let unionChilds= currentNode.children;
							entities.push(mapEntities[fieldName]= currentNode);
							// Parse members
							const union= typeChecker.getAliasedSymbol(
								typeChecker.getSymbolAtLocation(typeArg.typeName)!
							)?.declarations?.[0]
							?.getChildren().find(e=> e.kind===ts.SyntaxKind.UnionType);
							if(union==null || !ts.isUnionTypeNode(union))
								throw new Error(`Missing union types for: "${typeArg.getText()}" at ${typeArg.getSourceFile().fileName}`);
							else {
								let unionTypes= union.types;
								for(let k=0, klen= unionTypes.length; k<klen; ++k){
									let unionType= unionTypes[k];
									let dec= typeChecker.getTypeAtLocation(unionType).symbol?.declarations?.[0];
									if(dec==null || !(ts.isInterfaceDeclaration(dec) || ts.isClassDeclaration(dec)))
										throw new Error(`Illegal union type: ${dec?.getText()??typeArg.getText()} at ${typeArg.getSourceFile().fileName}`)
									else {
										unionChilds.push({
											kind: ModelKind.REF,
											name:	dec.name?.getText(),
											jsDoc: undefined,
											deprecated: undefined,
										});
										visitor.push( dec, undefined, isInput, generics, undefined);
									}
								}
							}
							break;
					}
				}
			}
		} else if(node.kind === ts.SyntaxKind.SyntaxList){
			visitor0.push(node.getChildren(), pDesc, isInput, generics, undefined);
		}
	}
	
	//* STEP 2: ADD DEFAULT SCALARS
	for(let i=0, len=  DEFAULT_SCALARS.length; i<len; ++i){
		let fieldName= DEFAULT_SCALARS[i];
		if(!mapEntities.hasOwnProperty(fieldName)){
			entities.push(mapEntities[fieldName]= {
				kind:	ModelKind.BASIC_SCALAR,
				name:	fieldName,
				jsDoc:	undefined,
				deprecated: undefined
			});
		}
	}

	//* STEP 3: Resolve other types
	const namelessEntities: NamelessEntity[]= [];
	it= visitor.it();
	while(true){
		// get next item
		let item= it.next();
		if(item.done) break;
		// ndoe
		let {node, parentDescriptor: pDesc, isInput, generics, flags: nodeFlags}= item.value;
		let fileName= node.getSourceFile().fileName;
		let meta: GetNodeMetadataReturn;
		let currentNode: ModelNode;
		let nodeType = typeChecker.getTypeAtLocation(node);
		let pkind: ModelKind;
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				//* Class or Interface entity
				meta= _getNodeMetadata(node, typeChecker);
				// Check not ignored and has "tsModel" or referenced
				if(meta.ignore || !(pDesc || meta.tsModel))
					continue;
				// Get entity name
				let className= (node as any).name?.getText();
				if(!className)
					throw new Error(`Enexpected class without name at ${fileName}:${node.getStart()}`);
				//  Expect "Export" keyword
				if(!(node as ts.ClassDeclaration).modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword))
					throw new Error(`Expected "export" keyword on ${ts.isClassDeclaration(node)?'class':'interface'}: "${className}" at ${fileName}:${node.getStart()}`);
				// get entity
				if(currentNode= mapEntities[className]){
					if(currentNode.kind!==ModelKind.PLAIN_OBJECT)
						throw new Error(`Enexpected PLAIN_OBJECT as ${ModelKind[currentNode.kind]} at ${fileName}`);
				}else{
					currentNode= {
						name:		className,
						kind:		ModelKind.PLAIN_OBJECT,
						jsDoc:		meta.jsDoc,
						deprecated: meta.deprecated,
						children:	[],
						mapChilds:	{},
						isClass:	nodeType.isClass()
					};
					mapEntities[className]= currentNode;
					entities.push(currentNode);
				}
				// Go through fields
				nodeType.getProperties().forEach(function({valueDeclaration, flags}){
					if(valueDeclaration)
						visitor.push(valueDeclaration, currentNode, isInput, generics, flags);
				});
				break;
			case ts.SyntaxKind.PropertyDeclaration:
			case ts.SyntaxKind.PropertySignature:
				//* Property declaration
				if(!pDesc) continue;
				meta= _getNodeMetadata(node, typeChecker);
				if(meta.ignore) continue;
				if (pDesc.kind !== ModelKind.PLAIN_OBJECT)
					throw new Error(`Expected parent as Plain object. Got ${ModelKind[pDesc.kind]} at ${fileName}::${node.getText()}`);
				// Current node
				let propertyName= (node as ts.PropertySignature).name.getText();
				let isRequiredField= !(nodeFlags==null? (node as ts.PropertyDeclaration).questionToken : nodeFlags & ts.SymbolFlags.Optional);
				if(currentNode = pDesc.mapChilds[propertyName]){
					// throw new Error(`Duplicate field ${propertyName} at ${fileName}::${node.getText()}`);
					currentNode.jsDoc ??= meta.jsDoc;
					currentNode.deprecated ??= meta.deprecated;
					// currentNode.required ??= !(node as ts.MethodDeclaration).questionToken;
					currentNode.required ??= isRequiredField;
					currentNode.defaultValue ??= meta.defaultValue;
					currentNode.asserts ??= meta.asserts;
				} else{
					currentNode = {
						kind:		ModelKind.FIELD,
						name:		propertyName,
						jsDoc:		meta.jsDoc,
						//TODO check to resolve this when "Partial" is used!
						required:	isRequiredField,
						children:	[],
						deprecated: meta.deprecated,
						defaultValue: meta.defaultValue,
						asserts:	meta.asserts,
						resolver:	undefined,
						input:		undefined
					};
					// Push to parent
					pDesc.children.push(pDesc.mapChilds[propertyName]= currentNode);
					// get input/output resolvers
					_getResolvers(propertyName, node as ts.PropertyDeclaration, currentNode);
				}
				// Go through childs
				visitor.push(node.getChildren(), currentNode, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.MethodDeclaration:
				//* Method declaration
				if(!pDesc) continue;
				if (pDesc.kind !== ModelKind.PLAIN_OBJECT)
					throw new Error(`Expected parent as Plain object. Got ${ModelKind[pDesc.kind]} at ${fileName}::${node.getText()}`);
				meta= _getNodeMetadata(node, typeChecker);
				if(meta.ignore) continue;
				// Current node
				let methodName= (node as ts.MethodDeclaration).name.getText();
				// resolver
				let resolverMethod: ObjectField['resolver']= undefined;
				let inputResolver: ObjectField['input']= undefined;
				let parentNameNode= (node.parent as ts.ClassDeclaration).name;
				if(!parentNameNode) throw new Error(`Expected parent Node at ${fileName} :: ${node.getText()}`);
				let parentName= parentNameNode.getText();
				if(isInput){
					inputResolver= {
						fileName:	node.getSourceFile().fileName,
						className:	parentName,
						isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
						name:		methodName
					};
					// inputResolver= `${parentDescriptor.oName??parentDescriptor.name}.prototype.${methodName}`;
				} else {
					resolverMethod= {
						kind:		ModelKind.METHOD,
						name:		methodName,
						jsDoc:		undefined,
						deprecated: undefined,
						// method:		node as ts.MethodDeclaration,
						method:		{
							fileName:	node.getSourceFile().fileName,
							className:	parentName,
							isStatic:	node.modifiers?.some(n=> n.kind===ts.SyntaxKind.StaticKeyword) ?? false,
							name:		methodName
						},
						// method: `${parentDescriptor.oName??parentDescriptor.name}.prototype.${methodName}`,
						/** [ResultType, ParamType] */
						children:	[undefined, undefined]
					};
				}
				// Parent field
				let isRequiredMethod= !(nodeFlags==null? (node as ts.MethodDeclaration).questionToken : nodeFlags & ts.SymbolFlags.Optional);
				if(currentNode= pDesc.mapChilds[methodName]){
					// throw new Error(`Duplicate field ${methodName} at ${fileName} :: ${node.getText()}`);
					currentNode.jsDoc ??= meta.jsDoc;
					currentNode.deprecated ??= meta.deprecated;
					currentNode.required ??= isRequiredMethod;
					currentNode.defaultValue ??= meta.defaultValue;
					currentNode.asserts ??= meta.asserts;
					if(resolverMethod) currentNode.resolver= resolverMethod
					if(inputResolver) currentNode.input= inputResolver
				} else {
					// Current node
					currentNode = {
						kind:		ModelKind.FIELD,
						name:		methodName,
						jsDoc:		meta.jsDoc,
						deprecated: meta.deprecated,
						required:	isRequiredMethod,
						children:	[],
						defaultValue: meta.defaultValue,
						asserts:	meta.asserts,
						resolver:	resolverMethod,
						input:		inputResolver
					};
					// Add to parent
					pDesc.children.push(pDesc.mapChilds[methodName] = currentNode);
					// Go through arg param
					// get input/output resolvers
					_getResolvers(methodName, node as ts.MethodDeclaration, currentNode);
				}
				if(!isInput){
					let params = (node as ts.MethodDeclaration).parameters;
					if (params && params[1])
						visitor.push(params[1], resolverMethod, isInput, generics, undefined);
				}
				// Go through results
				visitor.push(
					(node as ts.MethodDeclaration).type
					?? (typeChecker.getReturnTypeOfSignature(typeChecker.getSignatureFromDeclaration(node as ts.MethodDeclaration)!).symbol?.declarations?.[0])
					, resolverMethod || currentNode, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.Parameter:
				// Method parameter
				if(pDesc==null || pDesc.kind!==ModelKind.METHOD)
					throw new Error(`Expected parent as method. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'} at ${fileName}::${node.getText()}`);
				currentNode = {
					kind: ModelKind.PARAM,
					name: (node as ts.ParameterDeclaration).name.getText(),
					jsDoc: undefined,
					deprecated: undefined,
					children: []
				};
				pDesc.children[1] = currentNode;
				// Parse param type
				visitor.push((node as ts.ParameterDeclaration).type, currentNode, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.EnumDeclaration:
				//* Enumeration
				let enumName= (node as ts.EnumDeclaration).name.getText();
				//  Skip entities without "Export" keyword
				if(!((node as ts.EnumDeclaration).modifiers?.some(e=> e.kind=== ts.SyntaxKind.ExportKeyword))){
					if(pDesc)
						throw new Error(`Expected "export" keyword on enum "${enumName}" at ${fileName}`);
					continue;
				}
				// break if is from reference
				if(mapEntities[enumName])
					continue;
				meta= _getNodeMetadata(node, typeChecker);
				if(meta.ignore || !(pDesc || meta.tsModel)) continue;
				// get entity
				if(enumName && (currentNode= mapEntities[enumName])){
					if(currentNode.kind!==ModelKind.ENUM)
						throw new Error(`Enexpected ENUM as ${ModelKind[currentNode.kind]} at ${fileName}`);
				} else {
					currentNode= {
						name:		enumName,
						kind:		ModelKind.ENUM,
						jsDoc:		meta.jsDoc,
						deprecated: meta.deprecated,
						children:	[],
						mapChilds:	{}
					};
					if(enumName){
						mapEntities[enumName]= currentNode;
						entities.push(currentNode);
					}
				}
				// Go through fields
				visitor.push(node.getChildren(), currentNode, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.EnumMember:
				//* Enum member
				if(!pDesc || pDesc.kind!==ModelKind.ENUM)
					throw new Error(`Expected Enum as parent. Got ${pDesc?ModelKind[pDesc.kind]: 'nothing'}`);
				meta= _getNodeMetadata(node, typeChecker);
				let enumMemberName= (node as ts.EnumMember).name.getText();
				currentNode = {
					kind:		ModelKind.ENUM_MEMBER,
					name:		enumMemberName,
					jsDoc:		meta.jsDoc,
					deprecated: meta.deprecated,
					required:	true,
					value:		typeChecker.getConstantValue(node as ts.EnumMember)
					// value:		(node as ts.EnumMember).initializer?.getText()
				};
				pDesc.children.push(pDesc.mapChilds[enumMemberName]=currentNode);
				break;
			case ts.SyntaxKind.TypeLiteral:
				//* Type literal are equivalent to nameless classes
				if(!pDesc || pDesc.kind!== ModelKind.FIELD) continue;
				currentNode={
					name:		undefined,
					kind:		ModelKind.PLAIN_OBJECT,
					jsDoc:		undefined,
					deprecated: undefined,
					children:	[],
					mapChilds:	{},
					isClass:	false
				};
				let ref: ModelNode={
					kind: ModelKind.REF,
					name: undefined,
					jsDoc: undefined,
					deprecated: undefined
				};
				namelessEntities.push({
					name:	pDesc.name,
					node:	currentNode,
					ref:	ref
				});
				pDesc.children.push(ref);
				// Go through fields
				nodeType.getProperties().forEach(function({valueDeclaration, flags}){
					if(valueDeclaration)
						visitor.push(valueDeclaration, currentNode, isInput, generics, flags);
				});
				break;
			case ts.SyntaxKind.UnionType:
				let unionType:ts.TypeNode|undefined= undefined;
				(node as ts.UnionTypeNode).types.forEach(n=>{
					if(n.kind===ts.SyntaxKind.UndefinedKeyword)
						(pDesc as ObjectField).required= false;
					else if(unionType==null)
						unionType= n;
					else
						throw new Error(`Please give a name to the union "${node.getText()}".`);
				});
				if(unionType) visitor.push(unionType, pDesc, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.TypeOperator:
				visitor.push((node as ts.TypeOperatorNode).type, pDesc, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.TypeReference:
				//* Type reference
				if(!pDesc) continue;
				pkind= pDesc.kind;
				if(
					pkind!==ModelKind.FIELD
					&& pkind!==ModelKind.LIST
					&& pkind!==ModelKind.METHOD
					&& pkind!==ModelKind.PARAM
				){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
					continue;
				}
				if(nodeType.getSymbol()?.name === 'Promise'){
					// currentNode={
					// 	kind: ModelKind.PROMISE,
					// 	name: undefined,
					// 	jsDoc: undefined,
					// 	children: []
					// };
					// (pDesc as ObjectField).children.push(currentNode);
					visitor.push((node as ts.TypeReferenceNode).typeArguments!, pDesc, isInput, generics, undefined);
				} else {
					// Add reference
					let targetRef= (node as ts.TypeReferenceNode);
					let refName= targetRef.typeName.getText();
					let refNodeName: string; // referenced node's name
					if(generics?.has(refName)){
						targetRef = generics.get(refName)!;
						refName= targetRef.typeName.getText();
						if(targetRef.typeArguments?.length)
							refNodeName= `${refName}<${targetRef.typeArguments.map(e=>{
								let t= e.getText();
								return generics?.get(t)?.typeName.getText() ?? t;
							}).join(',')}>`;
						else
							refNodeName= refName;
					} else {
						refNodeName= targetRef.getText();
					}
					(pDesc as ObjectField).children[0]= {
						kind: ModelKind.REF,
						name: refNodeName,
						jsDoc: undefined,
						deprecated: undefined
					};
					// Resolve referenced item
					if(mapEntities[refNodeName]==null){
						// TODO add jsDoc resolver
						let refType= typeChecker.getTypeAtLocation(targetRef);
						let s= refType.symbol?.declarations?.[0]
						if(!s)
							throw new Error(`Fail to find declaration for ${targetRef.getText()} at ${node.getSourceFile().fileName}`);
						// console.log('---- reference: ', refNodeName, ts.SyntaxKind[node.kind]);
	
						// resolve generics
						let nodeArgs= (node as ts.TypeReferenceNode).typeArguments;
						if(nodeArgs?.length && (s as ts.InterfaceDeclaration).typeParameters!=null){
							generics= new Map(generics!);
							let targetArgs= (s as ts.InterfaceDeclaration).typeParameters!
							for(let i=0, len= nodeArgs.length; i<len; ++i){
								let ref= nodeArgs[i] as ts.TypeReferenceNode;
								let tParam= targetArgs[i].name.getText();
								generics.set(tParam, generics?.get(ref.getText())??ref)
							}
						}
	
						switch(s.kind){
							case ts.SyntaxKind.EnumMember:
								s= s.parent as ts.EnumDeclaration;
							case ts.SyntaxKind.EnumDeclaration:
								// node
								currentNode={
									kind: ModelKind.ENUM,
									name: refNodeName,
									jsDoc: undefined,
									deprecated: undefined,
									children: [],
									mapChilds: {}
								};
								visitor.push(s.getChildren(), currentNode, isInput, generics, undefined);
								break;
							case ts.SyntaxKind.InterfaceDeclaration:
							case ts.SyntaxKind.ClassDeclaration:
							case ts.SyntaxKind.MappedType:
								let properties= refType.getProperties();
								if(!properties.length)
									throw new Error(`Generic type "${targetRef.getText()}" has no fields! at ${node.getSourceFile().fileName}`);
								// node
								currentNode={
									kind: ModelKind.PLAIN_OBJECT,
									name: refNodeName,
									jsDoc: undefined,
									deprecated: undefined,
									children: [],
									mapChilds: {},
									isClass: true
								};
								properties.forEach(function(e){
									var n= e.valueDeclaration ?? e.declarations?.[0];
									if(n)
										visitor.push(n, currentNode, false, generics, e.flags);
								});
								break;
							default:
								throw new Error(`Unsupported kind "${ts.SyntaxKind[s.kind]}" of reference "${refNodeName}" at ${fileName}`);
						}
						entities.push(mapEntities[refNodeName]= currentNode);
					}
				}
				break;
			case ts.SyntaxKind.StringKeyword:
			case ts.SyntaxKind.BooleanKeyword:
			case ts.SyntaxKind.NumberKeyword:
			case ts.SyntaxKind.SymbolKeyword:
			case ts.SyntaxKind.BigIntKeyword:
				// Predefined scalars
				if(pDesc==null) continue;
				pkind= pDesc.kind;
				if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
					continue;
				}
				currentNode= {
					kind: ModelKind.REF,
					name: node.getText(),
					jsDoc: undefined,
					deprecated: undefined
				};
				(pDesc as ObjectField).children[0] = currentNode;
				break;
			case ts.SyntaxKind.ArrayType:
				if(pDesc==null) continue;
				pkind= pDesc.kind;
				if(pkind!==ModelKind.FIELD && pkind!==ModelKind.LIST && pkind!==ModelKind.METHOD && pkind!==ModelKind.PARAM){
					console.warn(`>> Escaped ${ts.SyntaxKind[node.kind]} from parent ${ModelKind[pkind]}: ${node.parent.getText()} at ${fileName}`);
					continue;
				}
				meta= _getNodeMetadata(node, typeChecker);
				currentNode = {
					kind:		ModelKind.LIST,
					name:		undefined,
					jsDoc:		meta.jsDoc,
					deprecated:	meta.deprecated,
					children:	[],
					asserts:	meta.asserts,
					input:		undefined
				};
				(pDesc as ModelNodeWithChilds).children[0] = currentNode;
				// Go through childs
				visitor.push((node as ts.ArrayTypeNode).elementType, currentNode, isInput, generics, undefined);
				break;
			case ts.SyntaxKind.SyntaxList:
				//* Syntax list
				visitor.push(node.getChildren(), pDesc, isInput, generics, undefined);
				break;
			// case ts.SyntaxKind.TypeAliasDeclaration:
			// 	console.log('----------------------------------------->> TYPE: ', node.getText());
			// 	break;
			case ts.SyntaxKind.TupleType:
				// Type type
				throw new Error(`Tuples are insupported, did you mean Array of type? at ${fileName}::${node.getText()}`);
				// break;
		}
	}

	//* STEP 4: Resolve nameless nodes
	const namelessMap:Map<string, number>= new Map();
	for(let i=0, len=namelessEntities.length; i<len; ++i){
		let item= namelessEntities[i];
		let itemName= item.name??'Entity';
		let itemI;
		let tmpn= itemName;
		while(mapEntities[itemName]){
			if(namelessMap.has(tmpn)) itemI= namelessMap.get(tmpn);
			else{
				itemI= 1;
				namelessMap.set(tmpn, itemI);
			}
			itemName= `${tmpn}_${i}`;
		}
		item.node.name= itemName;
		mapEntities[itemName]= item.node;
		item.ref.name= itemName; 
	}
	return result;
	// get input/output resolvers
	function _getResolvers(propertyName: string, node: ts.PropertyDeclaration| ts.PropertySignature|ts.MethodDeclaration, currentNode: ObjectField){
		var parentNode= node.parent as ts.ClassDeclaration;
		var c= resolversMapping.get(parentNode)?.get(propertyName)
		if(c!=null){
			currentNode.input??= c.input;
			currentNode.resolver??= c.output;
		}
	}
}


/** Get field or entity informations */
function _getNodeMetadata(node: ts.Node, typeChecker: ts.TypeChecker){
	const result: GetNodeMetadataReturn= {
		ignore:		false,
		tsModel:	false,
		jsDoc:		undefined,
		defaultValue: undefined,
		deprecated: undefined,
		asserts:	undefined
	}
	//TODO add default value
	var a: any;
	var i, len;
	// Ignore field if has "private" or "protected" keywords
	if(node.modifiers?.some(({kind})=>
		kind===ts.SyntaxKind.PrivateKeyword
		|| kind===ts.SyntaxKind.ProtectedKeyword
		|| kind===ts.SyntaxKind.AbstractKeyword
	))
		return result;
	// Load jsDoc tags
	var directives= [];
	var jsDoc: string[];
	var assertTxt: string;
	const asserts: string[]= [];
	// JSDOC
	jsDoc= typeChecker.getTypeAtLocation(node).symbol?.getDocumentationComment(typeChecker).map(e=> e.text) ?? [];
	let jsDocTags= ts.getJSDocTags(node);
	if(jsDocTags.length){
		for(i=0, len= jsDocTags.length; i<len; ++i){
			let tag= jsDocTags[i];
			let tagName= tag.tagName.getText();
			jsDoc.push(tag.getText());
			let tagText:any;
			switch(tagName){
				case 'assert':
					tagText= tag.comment;
					if(Array.isArray(tagText))
						tagText= tagText.map((l: ts.JSDocText)=> l.text).join(', ');
					// FIXME check using multiple lines for jsdoc tag
					if(tagText){
						directives.push(tagText? `${tagName}(${tagText})` : tagName);
						asserts.push(`[${tagText}]`);
					}
					break;
				case 'tsModel':
					result.tsModel= true;
					break;
				case 'ignore':
					result.ignore= true;
					break;
				case 'deprecated':
					tagText= tag.comment;
					if(Array.isArray(tagText))
						tagText= tagText.map((l: ts.JSDocText)=> l.text).join("\n");
					result.deprecated= `${tagText}`;
					break;
			}
		}
	}
	// load decorators
	if(node.decorators){
		let decos= node.decorators;
		let decoExp: ts.CallExpression;
		for(i=0, len= decos.length; i<len; ++i){
			decoExp= decos[i].expression as ts.CallExpression;
			directives.push(decoExp.getText());
			let s= typeChecker.getSymbolAtLocation(decoExp) ?? typeChecker.getSymbolAtLocation(decoExp.expression);
			switch(s?.name){
				case 'assert':
					asserts.push(`[${decoExp.arguments.map(a => a.getText()).join(',')}]`);
					break;
				case 'tsModel':
					result.tsModel= true;
					break;
				case 'ignore':
					result.ignore= true;
					break;
				case 'deprecated':
					result.deprecated= decoExp.arguments.map(a => a.getText()).join(',');
					break;
			}
		}
	}
	if(directives.length){
		jsDoc.push(...directives.map(n=> `@${n}`));
	}
	result.jsDoc= jsDoc.join("\n");
	// Compile asserts
	if(asserts.length){
		let assertObj= result.asserts= {};
		try{
			Object.assign(assertObj, ...asserts.map(e=> parseJSON(e)[0]));
		}catch(err){
			throw new Error(`Fail to parse assert arguments at ${node.getSourceFile().fileName}\n${asserts.join("\n")}\n${err?.stack}`);
		}
	}
	// Return
	return result;
}
interface GetNodeMetadataReturn{
	ignore: boolean
	tsModel: boolean
	jsDoc:	string|undefined
	deprecated: string|undefined
	defaultValue: any
	asserts: AssertOptions|undefined
}

/** Nameless entities */
interface NamelessEntity{
	name:	string|undefined
	node:	ModelObjectNode
	ref:	ModelRefNode
};

/**  */
interface ResolverItem{
	input?: MethodDescriptor,
	output?: ModelMethod
}
/** */
type ResolverFields= Map<string, ResolverItem>