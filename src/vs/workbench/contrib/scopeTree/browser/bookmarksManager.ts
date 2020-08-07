/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { URI } from 'vs/base/common/uri';
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';

export class BookmarksManager implements IBookmarksManager {
	static readonly WORKSPACE_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksWorkspace';
	static readonly GLOBAL_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksGlobal';

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) { }

	private globalBookmarks: Set<String> = new Set();		// The URIs of the stats that have a global bookmark
	private workspaceBookmarks: Set<String> = new Set();	// The URIs of the stats that have a workspace bookmark

	public addBookmark(resource: URI, scope: BookmarkType): void { }

	public getBookmark(resource: URI): BookmarkType {
		return BookmarkType.NONE;
	}

	public saveBookmarks(): void { }
}
