import { ModelKind, ModelObjectNode, ObjectField, RootModel } from "@src/schema/model.js";
import ts from "typescript";


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
	var root: RootModel= {
		models:	[],
		map:	{}
	}
	/** Visitor callback */
	function visitorCb(node: ts.Node): ts.VisitResult<ts.Node>{
		// Check for jsDoc
		// Classes & interfaces
		switch(node.kind){
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
				if(_isTsModel(node))
					_compileClazzInterface(node as TsClazzType);
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
		}
		return ts.visitEachChild(node, visitorCb, ctx);
	}
	/** Compile interface */
	function _compileClazzInterface(node: TsClazzType){
		if(node.name == null)
			throw new Error(`Expected interface name at: ${node.getStart()}`);
		console.log('compile interface>>', node.name.getText());
		var clazzFields:ObjectField[]= [], classFieldsMap:Record<string, ObjectField>= {};
		var clazz: ModelObjectNode= {
			name:		node.name.getText(),
			kind:		ModelKind.PLAIN_OBJECT,
			jsDoc:		undefined,
			fields:		clazzFields,
			fieldMap:	classFieldsMap
		};
		var i, len, members= node.members;
		for (i = 0, len= members.length; i < len; i++) {
			var field = node.members[i];
			if(field.name==null) continue;
			var fieldName= field.name.getText();
			var fieldDesc: ObjectField= {
				name:		fieldName,
				required:	true,
				value:      undefined,
				jsDoc:		undefined
			}
			clazzFields.push(fieldDesc);
			classFieldsMap[fieldName]= fieldDesc;
			var fieldChilds= field.getChildren();
			var j, jLen;
			console.log('>> Field:', fieldDesc.name)
			for (j = 0, jLen= fieldChilds.length; j < jLen; j++) {
				var fieldChild= fieldChilds[j];
				switch(fieldChild.kind){
					case ts.SyntaxKind.QuestionToken:
						fieldDesc.required= false;
						break;
					case ts.SyntaxKind.JSDocComment:
						fieldDesc.jsDoc= fieldChild.getChildren().map(e=> e.getText()).join("\n");
						break;
					case ts.SyntaxKind.TypeReference:
						//TODO
						break
					case ts.SyntaxKind.StringKeyword:
						// string
						break
					case ts.SyntaxKind.BooleanKeyword:
						// string
						break
					case ts.SyntaxKind.NumberKeyword:
						// string
						break
					case ts.SyntaxKind.SymbolKeyword:
						// string
						break
					case ts.SyntaxKind.BigIntKeyword:
						// string
						break
					default:
						throw new Error(`Enexpected field type at ${clazz.name}.${fieldDesc.name} :: ${fieldChild.getStart()}`);
				}
			}
		}
		console.log('------------------END-----------------')
	}
	/** Return */
	return visitorCb;
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

