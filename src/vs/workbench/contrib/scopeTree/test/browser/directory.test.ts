/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { getDirectoriesAsSortedTreeElements, findIndexInSortedArray } from 'vs/workbench/contrib/scopeTree/browser/directoryViewer';
import { URI } from 'vs/base/common/uri';
import { SortType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { basename } from 'vs/base/common/resources';

// Run these tests using the command 'yarn run mocha --run src/vs/workbench/contrib/scopeTree/test/browser/directory.test.ts'
suite('Recent directories sorting', () => {
	test('Sort resources by their basenames', function () {
		const resources = createNewRandomResources();
		const resourcesAsStrings = new Set(resources.map(res => res.toString()));
		const treeElements = getDirectoriesAsSortedTreeElements(resourcesAsStrings, SortType.NAME);
		let isSorted = true;
		for (let i = 0; i + 1 < treeElements.length; i++) {
			if (treeElements[i].element.getName() > treeElements[i + 1].element.getName()) {
				isSorted = false;
			}
		}

		assert.equal(isSorted, true);
	});

	test('Insert a resource in sorted array', function () {
		const resource = randomResource(5);
		const name = basename(resource);
		const resources = createNewRandomResources();
		const resourcesAsStrings = new Set(resources.map(res => res.toString()));
		const treeElements = getDirectoriesAsSortedTreeElements(resourcesAsStrings, SortType.NAME);
		const index = findIndexInSortedArray(name, treeElements);

		if (index === 0) {
			assert.equal(name <= treeElements[0].element.getName(), true);
		} else {
			if (index === treeElements.length) {
				assert.equal(treeElements[treeElements.length - 1].element.getName() <= name, true);
			} else {
				assert.equal(treeElements[index - 1].element.getName() <= name, true);
				assert.equal(name <= treeElements[index].element.getName(), true);
			}
		}
	});
});

// Create a file tree mock with random resources
const fileNames: string[] = [];
const directoryNames: string[] = [];
const workspaceFolder = 'memfs:/sample-folder/';
let resources: URI[] = [];

let populateFiles = (size: number): void => {
	for (let i = 0; i < size; i++) {
		fileNames.push('file' + i + '.java');
		fileNames.push('file' + i + '.cpp');
		fileNames.push('file' + i + '.ts');
		fileNames.push('file' + i + '.json');
	}
};

let populateDirs = (size: number): void => {
	for (let i = 0; i < size; i++) {
		directoryNames.push('folder' + i);
		directoryNames.push('common' + i);
		directoryNames.push('browser' + i);
		directoryNames.push('media' + i);
	}
};

let randomSet = (size: number, indexMax: number): Set<number> => {
	let selectedNumbers: Set<number> = new Set();

	while (selectedNumbers.size < size) {
		const numberSelected = Math.floor(Math.random() * indexMax);
		selectedNumbers.add(numberSelected);
	}

	return selectedNumbers;
};

let randomFiles = (size: number): Set<string> => {
	const indices = randomSet(size, fileNames.length);
	const files: Set<string> = new Set();

	indices.forEach(index => {
		files.add(fileNames[index]);
	});

	return files;
};

let randomDirs = (size: number): Set<string> => {
	const indices = randomSet(size, directoryNames.length);
	const dirs: Set<string> = new Set();

	indices.forEach(index => {
		dirs.add(directoryNames[index]);
	});

	return dirs;
};

let addFilesAndDirectories = (path: string, size: number, levels: number): void => {
	if (levels === 0) {
		return;
	}

	const filesSelected = randomFiles(size);
	const dirsSelected = randomDirs(size);

	for (let file of filesSelected) {
		const filePath = path + file;
		resources.push(URI.parse(filePath));
	}

	for (let dir of dirsSelected) {
		const dirPath = path + dir + '/';
		resources.push(URI.parse(dirPath));
		addFilesAndDirectories(dirPath, Math.floor(Math.random() * 7 + 1), levels - 1);
	}
};

let createNewRandomResources = () => {
	resources = [];
	populateFiles(10);
	populateDirs(10);
	addFilesAndDirectories(workspaceFolder, 7, 5);
	return resources;
};

let randomResource = (level: number) => {
	let resource = URI.parse(workspaceFolder);

	for (let i = 0; i < level; i++) {
		const numberSelected = Math.floor(Math.random() * directoryNames.length);
		resource = URI.joinPath(resource, directoryNames[numberSelected]);
	}

	return resource;
};
