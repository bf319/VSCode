/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { URI } from 'vs/base/common/uri';
import { IBookmarksManager, BookmarkType, SortType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Emitter } from 'vs/base/common/event';

export class BookmarksManager implements IBookmarksManager {
	declare readonly _serviceBrand: undefined;

	static readonly WORKSPACE_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksWorkspace';
	static readonly GLOBAL_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksGlobal';

	globalBookmarks: string[] = [];
	workspaceBookmarks: string[] = [];

	private _onAddedBookmark = new Emitter<{ uri: URI, bookmarkType: BookmarkType, prevBookmarkType: BookmarkType }>();
	public onAddedBookmark = this._onAddedBookmark.event;

	private _onDidSortBookmark = new Emitter<SortType>();
	public onDidSortBookmark = this._onDidSortBookmark.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		this.initializeBookmarks();
	}

	// Preserve sorting by date when bookmarks are added to the sets (most recent is kept at index 0)
	public addBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();
		let prevScope = BookmarkType.NONE;	// Undefined if bookmark already had the appropriate type

		if (scope === BookmarkType.GLOBAL) {
			if (this.deleteBookmark(resourceAsString, BookmarkType.GLOBAL)) {
				prevScope = BookmarkType.GLOBAL;
			}

			this.globalBookmarks.unshift(resourceAsString);
			this.saveGlobalBookmarks();

			if (this.deleteBookmark(resourceAsString, BookmarkType.WORKSPACE)) {
				this.saveWorkspaceBookmarks();
				prevScope = BookmarkType.WORKSPACE;
			}
		} else if (scope === BookmarkType.WORKSPACE) {
			if (this.deleteBookmark(resourceAsString, BookmarkType.WORKSPACE)) {
				prevScope = BookmarkType.WORKSPACE;
			}

			this.workspaceBookmarks.unshift(resourceAsString);
			this.saveWorkspaceBookmarks();

			if (this.deleteBookmark(resourceAsString, BookmarkType.GLOBAL)) {
				this.saveGlobalBookmarks();
				prevScope = BookmarkType.GLOBAL;
			}
		} else {
			if (this.deleteBookmark(resourceAsString, BookmarkType.GLOBAL)) {
				this.saveGlobalBookmarks();
				prevScope = BookmarkType.GLOBAL;
			}
			if (this.deleteBookmark(resourceAsString, BookmarkType.WORKSPACE)) {
				this.saveWorkspaceBookmarks();
				prevScope = BookmarkType.WORKSPACE;
			}
		}

		this._onAddedBookmark.fire({ uri: resource, bookmarkType: scope, prevBookmarkType: prevScope });
	}

	public getBookmarkType(resource: URI): BookmarkType {
		const resourceAsString = resource.toString();

		if (this.globalBookmarks.indexOf(resourceAsString) > -1) {
			return BookmarkType.GLOBAL;
		}

		if (this.workspaceBookmarks.indexOf(resourceAsString) > -1) {
			return BookmarkType.WORKSPACE;
		}

		return BookmarkType.NONE;
	}

	public toggleBookmarkType(resource: URI): BookmarkType {
		const newType = (this.getBookmarkType(resource) + 1) % 3;
		this.addBookmark(resource, newType);

		return newType;
	}

	public sortBookmarks(sortType: SortType) {
		this._onDidSortBookmark.fire(sortType);
	}

	private initializeBookmarks(): void {
		// Retrieve bookmarks from storageService
		this.initializeGlobalBookmarks();
		this.initializeWorkspaceBookmarks();
	}

	private initializeGlobalBookmarks(): void {
		const rawGlobalBookmarks = this.storageService.get(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, StorageScope.GLOBAL);
		if (rawGlobalBookmarks) {
			this.globalBookmarks = JSON.parse(rawGlobalBookmarks) as string[];
		}
	}

	private initializeWorkspaceBookmarks(): void {
		const rawWorkspaceBookmarks = this.storageService.get(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, StorageScope.WORKSPACE);
		if (rawWorkspaceBookmarks) {
			this.workspaceBookmarks = JSON.parse(rawWorkspaceBookmarks) as string[];
		}
	}

	private saveWorkspaceBookmarks(): void {
		this.storageService.store(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.workspaceBookmarks)), StorageScope.WORKSPACE);
	}

	private saveGlobalBookmarks(): void {
		this.storageService.store(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.globalBookmarks)), StorageScope.GLOBAL);
	}

	private deleteBookmark(resource: string, scope: BookmarkType): boolean {
		const bookmarks = scope === BookmarkType.WORKSPACE ? this.workspaceBookmarks : this.globalBookmarks;
		const index = bookmarks.indexOf(resource);
		if (index === -1) {
			return false;
		}

		if (scope === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks.splice(index, 1);
		} else if (scope === BookmarkType.GLOBAL) {
			this.globalBookmarks.splice(index, 1);
		}

		return true;
	}
}
