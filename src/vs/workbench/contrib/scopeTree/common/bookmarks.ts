/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';

export interface IBookmarksManager {
	globalBookmarks: Set<string>;

	addBookmark(resource: URI, scope: BookmarkType): void;
	getBookmark(resource: URI): BookmarkType;
	toggleBookmark(resource: URI): BookmarkType;
}

export const IBookmarksManager = createDecorator<IBookmarksManager>('bookmarksManager');

export const enum BookmarkType {
	NONE = 'bookmark-not-set',
	GLOBAL = 'bookmark-set-global',
	WORKSPACE = 'bookmark-set-workspace'
}
