/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Directory } from 'vs/workbench/contrib/scopeTree/browser/directoryViewer';
import { SortType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';

suite('Recent directories - Sorting', () => {

	test('Sort directories by name', function () {
		const directories = new Set(['/folder/subfolder/a', '/folder/subfolder/b', 'folder/subfolder/c']);
		const result = Directory.getDirectoriesAsSortedTreeElements(directories, SortType.NAME);
		let isSorted = true;

		for (let i = 0; i < result.length - 1; i++) {
			if (result[i].element.getName() > result[i + 1].element.getName()) {
				isSorted = false;
			}
		}

		assert.equal(isSorted, true);
	});
});
