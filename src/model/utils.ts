/** Clone object */
export function clone<T extends object>(data: object): T {
	//FIXME implement this logic
	return data as T;
}

/** Extract partial fields that are not null */
export function partial<T extends object>(data: object): Partial<T> {
	//FIXME implement this logic
	const result: Partial<T> = {};
	for (let k in data) {
		if (data.hasOwnProperty(k) && data[k as keyof typeof data] != null) {
			result[k as keyof Partial<T>] = data[k as keyof typeof data];
		}
	}
	return result;
}