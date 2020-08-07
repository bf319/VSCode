/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ILabelService } from 'vs/platform/label/common/label';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IBookmarksManager } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { BookmarksManager } from 'vs/workbench/contrib/scopeTree/browser/bookmarksManager';

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	private globalBookmarks: Set<string>;
	private workspaceBookmarks: Set<string>;

	constructor(
		options: IViewletViewOptions,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IConfigurationService configurationService: IConfigurationService,
		@ILabelService private labelService: ILabelService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IBookmarksManager bookmarksManager: IBookmarksManager
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
		this.globalBookmarks = new Set();
		this.workspaceBookmarks = new Set();

		for (let i = 0; i < 10; i++) {
			this.globalBookmarks.add('global/path1/path2/path' + i);
			this.workspaceBookmarks.add('workspace/path1/path2/path' + i);
		}
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const displayGlobalBookmarks = document.createElement('ul');
		container.appendChild(displayGlobalBookmarks);

		for (let bookmark of this.globalBookmarks) {
			const bookmarkContainer = document.createElement('li');
			bookmarkContainer.innerText = bookmark;
			displayGlobalBookmarks.appendChild(bookmarkContainer);
		}

	}
}
