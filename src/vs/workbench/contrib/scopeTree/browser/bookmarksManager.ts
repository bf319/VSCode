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

	// Yellow bookmark = workspace
	// Red bookmark = global

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		this.initializeBookmarks();
	}

	private globalBookmarks: Set<string> = new Set();		// The URIs of the stats that have a global bookmark
	private workspaceBookmarks: Set<string> = new Set();	// The URIs of the stats that have a workspace bookmark

	public addBookmark(resource: URI, scope: BookmarkType): void {
		const resourceAsString = resource.toString();

		this.globalBookmarks.delete(resourceAsString);
		this.workspaceBookmarks.delete(resourceAsString);

		if (scope === BookmarkType.GLOBAL) {
			this.globalBookmarks.add(resourceAsString);
		}

		if (scope === BookmarkType.WORKSPACE) {
			this.workspaceBookmarks.add(resourceAsString);
		}

		this.saveBookmarks();
	}

	public getBookmark(resource: URI): BookmarkType {
		const resourceAsString = resource.toString();

		if (this.globalBookmarks.has(resourceAsString)) {
			return BookmarkType.GLOBAL;
		}

		if (this.workspaceBookmarks.has(resourceAsString)) {
			return BookmarkType.WORKSPACE;
		}

		return BookmarkType.NONE;
	}

	public toggleBookmark(resource: URI): BookmarkType {
		const newType = (this.getBookmark(resource) + 1) % 3;
		this.addBookmark(resource, newType);

		return newType;
	}

	private initializeBookmarks(): void {
		// Retrieve bookmarks from storageService
		this.initializeGlobalBookmarks();
		this.initializeWorkspaceBookmarks();
	}

	private saveBookmarks(): void {
		this.saveGlobalBookmarks();
		this.saveWorkspaceBookmarks();
	}

	private initializeGlobalBookmarks(): void {
		const rawGlobalBookmarks = this.storageService.get(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, StorageScope.GLOBAL);
		if (rawGlobalBookmarks) {
			const gBookmarks = JSON.parse(rawGlobalBookmarks) as URI[];
			for (let i = 0; i < gBookmarks.length; i++) {
				const uriAsString = gBookmarks[i].toString();
				this.globalBookmarks.add(uriAsString);
			}
		}
	}

	private initializeWorkspaceBookmarks(): void {
		const rawWorkspaceBookmarks = this.storageService.get(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, StorageScope.WORKSPACE);
		if (rawWorkspaceBookmarks) {
			const wBookmarks = JSON.parse(rawWorkspaceBookmarks) as URI[];
			for (let i = 0; i < wBookmarks.length; i++) {
				const uriAsString = wBookmarks[i].toString();
				this.workspaceBookmarks.add(uriAsString);
			}
		}
	}

	private saveWorkspaceBookmarks(): void {
		this.storageService.store(BookmarksManager.WORKSPACE_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.workspaceBookmarks)), StorageScope.WORKSPACE);
	}

	private saveGlobalBookmarks(): void {
		this.storageService.store(BookmarksManager.GLOBAL_BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(this.globalBookmarks)), StorageScope.GLOBAL);
	}
}
