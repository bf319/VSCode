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
		const bigWorkspaceContainer = document.createElement('div');
		container.appendChild(bigWorkspaceContainer);
		bigWorkspaceContainer.style.paddingLeft = '20px';
		bigWorkspaceContainer.style.maxHeight = '50%';
		const workspaceContainer = document.createElement('div');
		bigWorkspaceContainer.appendChild(workspaceContainer);
		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.$(Codicon.chevronDown.cssSelector);
		const bookmarkIcon = document.createElement('img');
		const containerTitle = document.createElement('b');

		workspaceContainer.className = 'bookmark-header';

		containerTitle.innerText = 'WORKSPACE BOOKMARKS';
		containerTitle.style.color = 'black';
		bookmarkIcon.className = 'bookmark-set-workspace';

		workspaceContainer.appendChild(collapsedTwistie);
		workspaceContainer.appendChild(bookmarkIcon);
		workspaceContainer.appendChild(containerTitle);

		const bookmarksList = this.renderWorkspaceBookmarks(bigWorkspaceContainer);
		bookmarksList.style.maxHeight = '100%';

		workspaceContainer.onclick = () => {
			if (bookmarksList.style.display === 'none') {
				workspaceContainer.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksList.style.display = '';
			} else {
				workspaceContainer.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksList.style.display = 'none';
			}
		};

	}

	private renderGlobalBookmarksContainer(container: HTMLElement): void {
		const bigGlobalContainer = document.createElement('div');
		container.appendChild(bigGlobalContainer);
		bigGlobalContainer.style.maxHeight = '50%';
		bigGlobalContainer.style.paddingLeft = '20px';
		const globalContainer = document.createElement('div');
		bigGlobalContainer.appendChild(globalContainer);
		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.$(Codicon.chevronDown.cssSelector);
		const bookmarkIcon = document.createElement('img');
		const containerTitle = document.createElement('b');

		globalContainer.className = 'bookmark-header';

		containerTitle.innerText = 'GLOBAL BOOKMARKS';
		containerTitle.style.color = 'black';
		bookmarkIcon.className = 'bookmark-set-global';

		globalContainer.appendChild(collapsedTwistie);
		globalContainer.appendChild(bookmarkIcon);
		globalContainer.appendChild(containerTitle);

		const bookmarksList = this.renderGlobalBookmarks(bigGlobalContainer);

		globalContainer.onclick = () => {
			if (bookmarksList.style.display === 'none') {
				globalContainer.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksList.style.display = '';
			} else {
				globalContainer.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksList.style.display = 'none';
			}
		};
	}

	private renderWorkspaceBookmarks(container: HTMLElement): HTMLElement {
		const bookmarksList = document.createElement('ul');
		container.appendChild(bookmarksList);

		bookmarksList.style.marginTop = '0px';
		bookmarksList.style.height = '100%';
		bookmarksList.style.overflow = 'hidden';
		bookmarksList.style.listStylePosition = 'inside';
		bookmarksList.style.padding = '0px';

		const workspaceBookmarks = this.bookmarksManager.workspaceBookmarks;
		for (let bookmark of workspaceBookmarks) {
			const element = document.createElement('li');
			bookmarksList.appendChild(element);
			element.style.listStyleType = 'none';

			const focusIcon = DOM.append(element, document.createElement('img'));
			focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

			element.addEventListener('mouseover', () => {
				focusIcon.style.visibility = 'visible';
				element.style.background = '#eee';
			});

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

		bookmarksList.style.display = 'none';

		return bookmarksList;
	}

	private renderGlobalBookmarks(container: HTMLElement): HTMLElement {
		const bookmarksList = document.createElement('ul');
		container.appendChild(bookmarksList);

		bookmarksList.style.marginTop = '0px';
		bookmarksList.style.height = '100%';
		bookmarksList.style.overflow = 'hidden';
		bookmarksList.style.listStylePosition = 'inside';
		bookmarksList.style.padding = '0px';

		const globalBookmarks = this.bookmarksManager.globalBookmarks;
		for (let bookmark of globalBookmarks) {
			const element = document.createElement('li');
			bookmarksList.appendChild(element);
			element.style.listStyleType = 'none';

			const focusIcon = DOM.append(element, document.createElement('img'));
			focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

			element.addEventListener('mouseover', () => {
				focusIcon.style.visibility = 'visible';
				element.style.background = '#eee';
			});

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

		bookmarksList.style.display = 'none';

		return bookmarksList;
	}
}
