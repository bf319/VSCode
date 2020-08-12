/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { URI } from 'vs/base/common/uri';
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Emitter } from 'vs/base/common/event';

export class BookmarksManager implements IBookmarksManager {
	static readonly WORKSPACE_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksWorkspace';
	static readonly GLOBAL_BOOKMARKS_STORAGE_KEY: string = 'workbench.explorer.bookmarksGlobal';

	// Yellow bookmark = workspace
	// Red bookmark = global

	globalBookmarks: Set<string> = new Set();
	workspaceBookmarks: Set<string> = new Set();

	private _onAddedBookmark = new Emitter<{ uri: URI, bookmarkType: BookmarkType }>();
	public onAddedBookmark = this._onAddedBookmark.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		this.initializeBookmarks();
	}

	public addBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();

		if (scope === BookmarkType.GLOBAL) {
			if (!this.globalBookmarks.has(resourceAsString)) {
				this.globalBookmarks.add(resourceAsString);
				this.saveGlobalBookmarks();
			}
			if (this.workspaceBookmarks.delete(resourceAsString)) {
				this.saveWorkspaceBookmarks();
			}
		} else if (scope === BookmarkType.WORKSPACE) {
			if (!this.workspaceBookmarks.has(resourceAsString)) {
				this.workspaceBookmarks.add(resourceAsString);
				this.saveWorkspaceBookmarks();
			}
			if (this.globalBookmarks.delete(resourceAsString)) {
				this.saveGlobalBookmarks();
			}
		} else {
			if (this.globalBookmarks.delete(resourceAsString)) {
				this.saveGlobalBookmarks();
			}
			if (this.workspaceBookmarks.delete(resourceAsString)) {
				this.saveWorkspaceBookmarks();
			}
		}

		this._onAddedBookmark.fire({ uri: resource, bookmarkType: scope });
	}

	public getBookmarkType(resource: URI): BookmarkType {
		const resourceAsString = resource.toString();

		if (this.globalBookmarks.has(resourceAsString)) {
			return BookmarkType.GLOBAL;
		}

		if (this.workspaceBookmarks.has(resourceAsString)) {
			return BookmarkType.WORKSPACE;
		}

		return BookmarkType.NONE;
	}

	public toggleBookmarkType(resource: URI): BookmarkType {
		const newType = (this.getBookmarkType(resource) + 1) % 3;
		this.addBookmark(resource, newType);

		return newType;
	}

	private initializeBookmarks(): void {
		// Retrieve bookmarks from storageService
		this.initializeGlobalBookmarks();
		this.initializeWorkspaceBookmarks();
	}

	private initializeGlobalBookmarks(): void {
		const rawGlobalBookmarks = this.storageService.get(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, StorageScope.GLOBAL);
		if (rawGlobalBookmarks) {
			const gBookmarks = JSON.parse(rawGlobalBookmarks) as string[];
			this.globalBookmarks = new Set(gBookmarks);
		}
	}

	private initializeWorkspaceBookmarks(): void {
		const rawWorkspaceBookmarks = this.storageService.get(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, StorageScope.WORKSPACE);
		if (rawWorkspaceBookmarks) {
			const wBookmarks = JSON.parse(rawWorkspaceBookmarks) as string[];
			this.workspaceBookmarks = new Set(wBookmarks);
		}
	}

	private saveWorkspaceBookmarks(): void {
		this.storageService.store(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.workspaceBookmarks)), StorageScope.WORKSPACE);
	}

	private saveGlobalBookmarks(): void {
		this.storageService.store(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.globalBookmarks)), StorageScope.GLOBAL);
	}
}
