/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRecentDirectoriesManager } from 'vs/workbench/contrib/scopeTree/common/recentDirectories';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { withNullAsUndefined } from 'vs/base/common/types';
import { toResource, SideBySideEditor } from 'vs/workbench/common/editor';
import { dirname } from 'vs/base/common/resources';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';

export class RecentDirectoriesManager implements IRecentDirectoriesManager {
	declare readonly _serviceBrand: undefined;

	readonly STORAGE_SIZE: number = 20;
	static readonly RECENT_DIRECTORIES_STORAGE_KEY: string = 'workbench.explorer.recentDirectoriesStorageKey';

	private _onRecentDirectoriesChanged = new Emitter<void>();
	public onRecentDirectoriesChanged = this._onRecentDirectoriesChanged.event;

	recentDirectories: Set<string> = new Set();

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IEditorService private readonly editorService: IEditorService,
		@IExplorerService private readonly explorerService: IExplorerService
	) {
		this.retrieveRecentDirectories();

		// Mark the parent of active file as a 'recent directory'
		this.editorService.onDidActiveEditorChange(() => {
			const resource = this.getActiveFile();
			if (resource) {
				const parentDirectory = dirname(resource).toString();
				this.saveRecentDirectory(parentDirectory);
				this.storeRecentDirectories();
			}
		});

		// Mark a directory that is set as root as 'recent'
		// this.explorerService.onDidChangeRoot(roots => {
		this.explorerService.onDidChangeRoot(() => {
			this.explorerService.roots.forEach(root => this.saveRecentDirectory(root.resource.toString()));
			this.storeRecentDirectories();
		});
	}

	private saveRecentDirectory(resource: string): void {
		// Directory was already visited recently, mark it as most recent by making reinserting it in the set
		if (this.recentDirectories.has(resource)) {
			this.recentDirectories.delete(resource);
			this.recentDirectories.add(resource);
			this._onRecentDirectoriesChanged.fire();
			return;
		}

		this.recentDirectories.add(resource);
		if (this.recentDirectories.size > this.STORAGE_SIZE) {
			// Need to remove entry at position 0
			const removedItem = this.recentDirectories.values().next().value;
			this.recentDirectories.delete(removedItem);
		}

		this._onRecentDirectoriesChanged.fire();
	}

	private getActiveFile(): URI | undefined {
		const input = this.editorService.activeEditor;

		if (input instanceof DiffEditorInput) {
			return undefined;
		}

		return withNullAsUndefined(toResource(input, { supportSideBySide: SideBySideEditor.PRIMARY }));
	}

	private retrieveRecentDirectories(): void {
		const rawRecentDirectories = this.storageService.get(RecentDirectoriesManager.RECENT_DIRECTORIES_STORAGE_KEY, StorageScope.GLOBAL);
		if (rawRecentDirectories) {
			const parsedRecentDirectories = JSON.parse(rawRecentDirectories) as string[];
			this.recentDirectories = new Set(parsedRecentDirectories);
		}
	}

	private storeRecentDirectories(): void {
		this.storageService.store(RecentDirectoriesManager.RECENT_DIRECTORIES_STORAGE_KEY, JSON.stringify(Array.from(this.recentDirectories)), StorageScope.GLOBAL);
	}
}
