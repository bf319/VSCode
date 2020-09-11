/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { IFileService } from 'vs/platform/files/common/files';
import { coalesce } from 'vs/base/common/arrays';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { SortOrder } from 'vs/workbench/contrib/files/common/files';
import { ExplorerItem } from 'vs/workbench/contrib/files/common/explorerModel';
import { Emitter, Event } from 'vs/base/common/event';

export class ExplorerModel implements IDisposable {

	private _roots!: ExplorerItem[];
	private _listener: IDisposable;
	private readonly _onDidChangeWorkspaceFolders = new Emitter<void>();

	constructor(
		private readonly contextService: IWorkspaceContextService,
		private readonly fileService: IFileService
	) {
		const setRoots = () => this._roots = this.contextService.getWorkspace().folders
			.map(folder => new ExplorerItem(folder.uri, fileService, undefined, true, false, folder.name));
		setRoots();

		this._listener = this.contextService.onDidChangeWorkspaceFolders(() => {
			setRoots();
			this._onDidChangeWorkspaceFolders.fire();
		});
	}

	get roots(): ExplorerItem[] {
		return this._roots;
	}

	get onDidChangeWorkspaceFolders(): Event<void> {
		return this._onDidChangeWorkspaceFolders.event;
	}

	async setRoot(resource: URI, sortOrder: SortOrder): Promise<void> {
		const root = new ExplorerItem(resource, this.fileService, undefined);

		const children = await root.fetchChildren(sortOrder);
		children.forEach(child => {
			root.addChild(child);
		});

		this._roots = [root];
	}

	/**
	 * Returns an array of child stat from this stat that matches with the provided path.
	 * Starts matching from the first root.
	 * Will return empty array in case the FileStat does not exist.
	 */
	findAll(resource: URI): ExplorerItem[] {
		return coalesce(this.roots.map(root => root.find(resource)));
	}

	/**
	 * Returns a FileStat that matches the passed resource.
	 * In case multiple FileStat are matching the resource (same folder opened multiple times) returns the FileStat that has the closest root.
	 * Will return undefined in case the FileStat does not exist.
	 */
	findClosest(resource: URI): ExplorerItem | null {
		const folder = this.contextService.getWorkspaceFolder(resource);
		if (folder) {
			let root = this.roots.find(r => r.resource.toString() === folder.uri.toString());
			if (!root) {
				// Happens if root has been changed and is no longer a workspace folder. If this is so, only one root exists
				// so begin the search there.
				root = this.roots[0];
			}

			return root.find(resource);
		}

		return null;
	}

	dispose(): void {
		dispose(this._listener);
	}
}
