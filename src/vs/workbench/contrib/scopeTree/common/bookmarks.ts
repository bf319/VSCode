/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';

export interface IBookmarksManager {
	addBookmark(resource: URI, scope: BookmarkType): void;
	getBookmarkType(resource: URI): BookmarkType;
	toggleBookmarkType(resource: URI): BookmarkType;
}

export const IBookmarksManager = createDecorator<IBookmarksManager>('bookmarksManager');

export const enum BookmarkType {
	NONE,
	WORKSPACE,
	GLOBAL
}

export function bookmarkClass(type: BookmarkType): string {
	if (type === BookmarkType.GLOBAL) {
		return 'bookmark-set-global';
	}

	if (type === BookmarkType.WORKSPACE) {
		return 'bookmark-set-workspace';
	}

	return 'bookmark-not-set';
}
