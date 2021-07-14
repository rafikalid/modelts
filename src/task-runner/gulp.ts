import { generateModel } from '@src/transformer/program';
import Through from 'through2';
import Vinyl from "vinyl";

/** Gulp options */
export interface GulpOptions{
	tsConfigPath: string,
	pretty:boolean
}
/** Adapter for gulp */
export function createGulpPipe({tsConfigPath, pretty=true}:GulpOptions){
	return Through.obj(function(file: Vinyl, _:any, cb: Through.TransformCallback){
		if(file.extname===".ts"){
			let content= generateModel(tsConfigPath, file.path, pretty);
			if(typeof content === 'string'){
				file.contents= Buffer.from(content);
			}
		}
		cb(null, file);
	});
}