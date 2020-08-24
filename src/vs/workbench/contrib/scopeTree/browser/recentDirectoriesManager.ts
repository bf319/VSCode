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

export class RecentDirectoriesManager implements IRecentDirectoriesManager {
	declare readonly _serviceBrand: undefined;

	readonly STORAGE_SIZE: number = 20;
	static readonly RECENT_DIRECTORIES_STORAGE_KEY: string = 'workbench.explorer.recentDirectoriesStorageKey';

	private _onOpenedDirectory = new Emitter<string>();
	public onOpenedDirectory = this._onOpenedDirectory.event;

	recentDirectories: Set<string> = new Set();

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IEditorService private readonly editorService: IEditorService
	) {
		this.retrieveRecentDirectories();

		// Mark the parent of active file as a 'recent directory'
		this.editorService.onDidActiveEditorChange(() => {
			const resource = this.getActiveFile();
			if (resource) {
				const parentDirectory = dirname(resource).toString();
				this.saveOpenedDirectory(parentDirectory);
				this.storeRecentDirectories();
				this._onOpenedDirectory.fire(parentDirectory);
			}
		});
	}

	private saveOpenedDirectory(resource: string): void {
		const recentDirectoriesAsArray = Array.from(this.recentDirectories);

		// Directory was already visited recently, move it to the front
		if (this.recentDirectories.has(resource)) {
			const elementIndex = recentDirectoriesAsArray.indexOf(resource);
			recentDirectoriesAsArray.splice(elementIndex, 1);
			recentDirectoriesAsArray.unshift(resource);
			this.recentDirectories = new Set(recentDirectoriesAsArray);
			return;
		}

		recentDirectoriesAsArray.unshift(resource);
		if (recentDirectoriesAsArray.length > this.STORAGE_SIZE) {
			recentDirectoriesAsArray.splice(recentDirectoriesAsArray.length - 1, 1);
		}

		this.recentDirectories = new Set(recentDirectoriesAsArray);
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
