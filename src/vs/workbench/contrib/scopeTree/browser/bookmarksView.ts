/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/bookmarkIcon';
import * as DOM from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IBookmarksManager } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Codicon } from 'vs/base/common/codicons';
import { dirname, basename } from 'vs/base/common/resources';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';

	constructor(
		options: IViewletViewOptions,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IBookmarksManager private readonly bookmarksManager: IBookmarksManager,
		@IExplorerService private readonly explorerService: IExplorerService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.renderWorkspaceBookmarksContainer(container);
		this.renderGlobalBookmarksContainer(container);
	}

	private renderWorkspaceBookmarksContainer(container: HTMLElement): void {
		const workspaceHeader = DOM.append(container, document.createElement('div'));
		workspaceHeader.className = 'bookmark-header';

		const workspaceContainer = DOM.append(container, document.createElement('div'));
		workspaceContainer.className = 'bookmarks-container';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.append(workspaceHeader, DOM.$(Codicon.chevronDown.cssSelector));
		const workspaceIcon = DOM.append(workspaceHeader, document.createElement('img'));
		workspaceIcon.className = 'bookmark-header-workspace-icon';

		const containerTitle = DOM.append(workspaceHeader, document.createElement('span'));
		containerTitle.innerText = 'WORKSPACE BOOKMARKS';
		containerTitle.style.color = 'black';

		const bookmarksList = this.renderWorkspaceBookmarks(workspaceContainer);

		workspaceHeader.onclick = () => {
			// Toggle contents and twistie icon, and add some paddinnng
			if (bookmarksList.style.display === 'none') {
				workspaceHeader.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksList.style.display = '';
			} else {
				workspaceHeader.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksList.style.display = 'none';
			}
		};
	}

	private renderWorkspaceBookmarks(container: HTMLElement): HTMLElement {
		const bookmarksList = DOM.append(container, document.createElement('ul'));
		const workspaceBookmarks = this.bookmarksManager.workspaceBookmarks;

		for (let bookmark of workspaceBookmarks) {
			const element = DOM.append(bookmarksList, document.createElement('li'));
			element.style.listStyleType = 'none';

			const focusIcon = DOM.append(element, document.createElement('img'));
			focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

			// Emphasize elements
			element.addEventListener('mouseover', () => {
				focusIcon.style.visibility = 'visible';
				element.style.background = '#eee';
			});

			// Remove decorations
			element.addEventListener('mouseout', () => {
				focusIcon.style.visibility = 'hidden';
				element.style.background = '';
			});

			focusIcon.addEventListener('click', () => {
				this.explorerService.setRoot(URI.parse(bookmark));
			});

			const name = DOM.append(element, document.createElement('span'));
			name.textContent = basename(URI.parse(bookmark));
			name.style.color = 'black';

			const path = DOM.append(element, document.createElement('span'));
			path.className = 'bookmark-path';
			path.textContent = dirname(URI.parse(bookmark)).toString();
		}

		return bookmarksList;
	}

	private renderGlobalBookmarksContainer(container: HTMLElement): void {
		const globalHeader = DOM.append(container, document.createElement('div'));
		globalHeader.className = 'bookmark-header';

		const globalContainer = DOM.append(container, document.createElement('div'));
		globalContainer.className = 'bookmarks-container';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.append(globalHeader, DOM.$(Codicon.chevronDown.cssSelector));

		const bookmarkIcon = DOM.append(globalHeader, document.createElement('img'));
		bookmarkIcon.className = 'bookmark-header-global-icon';

		const containerTitle = DOM.append(globalHeader, document.createElement('span'));
		containerTitle.innerText = 'GLOBAL BOOKMARKS';
		containerTitle.style.color = 'black';

		const bookmarksList = this.renderGlobalBookmarks(globalContainer);

		globalHeader.onclick = () => {
			if (bookmarksList.style.display === 'none') {
				globalHeader.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksList.style.display = '';
			} else {
				globalHeader.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksList.style.display = 'none';
			}
		};
	}

	private renderGlobalBookmarks(container: HTMLElement): HTMLElement {
		const bookmarksList = DOM.append(container, document.createElement('ul'));

		const globalBookmarks = this.bookmarksManager.globalBookmarks;
		for (let bookmark of globalBookmarks) {
			const element = DOM.append(bookmarksList, document.createElement('li'));
			element.style.listStyleType = 'none';

			const focusIcon = DOM.append(element, document.createElement('img'));
			focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

			// Emphasize elements
			element.addEventListener('mouseover', () => {
				focusIcon.style.visibility = 'visible';
				element.style.background = '#eee';
			});

			// Remove decorations
			element.addEventListener('mouseout', () => {
				focusIcon.style.visibility = 'hidden';
				element.style.background = '';
			});

			focusIcon.addEventListener('click', () => {
				this.explorerService.setRoot(URI.parse(bookmark));
			});

			const name = DOM.append(element, document.createElement('span'));
			name.textContent = basename(URI.parse(bookmark));
			name.style.color = 'black';

			const path = DOM.append(element, document.createElement('span'));
			path.className = 'bookmark-path';
			path.textContent = dirname(URI.parse(bookmark)).toString();
		}

		return bookmarksList;
	}
}
