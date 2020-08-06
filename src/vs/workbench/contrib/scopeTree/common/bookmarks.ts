/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';

export interface IBookmarksManager {
	addBookmark(resource: URI, scope: BookmarkType): void;
	getBookmark(resource: URI): BookmarkType;
	saveBookmarks(): void;
}

export const IBookmarksManager = createDecorator<IBookmarksManager>('bookmarksManager');

export const enum BookmarkType {
	NONE,
	GLOBAL,
	WORKSPACE
}
