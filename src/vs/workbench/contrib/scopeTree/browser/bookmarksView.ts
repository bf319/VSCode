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
import { IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Codicon } from 'vs/base/common/codicons';
import { dirname, basename } from 'vs/base/common/resources';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { IListVirtualDelegate, IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore } from 'vs/base/common/filters';
import { ITreeRenderer, ITreeNode, ITreeElement } from 'vs/base/browser/ui/tree/tree';

class Bookmark {
	public resource: URI;

	constructor(path: string) {
		this.resource = URI.parse(path);
	}

	public getName(): string {
		return basename(this.resource);
	}

	public getParent(): string {
		return dirname(this.resource).toString();
	}
}

export class BookmarksDelegate implements IListVirtualDelegate<Bookmark> {
	static readonly ITEM_HEIGHT = 22;

	getHeight(element: Bookmark): number {
		return BookmarksDelegate.ITEM_HEIGHT;
	}

	getTemplateId(element: Bookmark): string {
		return 'BookmarksRenderer';
	}
}

interface IBookmarkTemplateData {
	bookmarkContainer: HTMLElement;
	elementDisposable: IDisposable;
}

class BookmarkDisposable implements IDisposable {
	constructor(private focusIcon: HTMLElement,
		private name: HTMLElement,
		private path: HTMLElement,
		private bookmarkContainer: HTMLElement
	) { }

	dispose(): void {
		this.focusIcon.remove();
		this.name.remove();
		this.path.remove();
		this.bookmarkContainer.remove();
	}
}

class BookmarksRenderer implements ITreeRenderer<Bookmark, FuzzyScore, IBookmarkTemplateData> {
	static readonly ID = 'BookmarksRenderer';

	constructor(
		private readonly bookmarkType: BookmarkType,
		private readonly explorerService: IExplorerService
	) {
		// noop
	}

	renderElement(element: ITreeNode<Bookmark, FuzzyScore>, index: number, templateData: IBookmarkTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderBookmark(element.element, templateData);
	}

	get templateId() {
		return BookmarksRenderer.ID;
	}

	renderTemplate(container: HTMLElement): IBookmarkTemplateData {
		return { bookmarkContainer: container, elementDisposable: Disposable.None };
	}

	disposeTemplate(templateData: IBookmarkTemplateData): void {
		templateData.elementDisposable.dispose();
	}

	disposeElement(element: ITreeNode<Bookmark, FuzzyScore>, index: number, templateData: IBookmarkTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
	}

	private renderBookmark(bookmark: Bookmark, templateData: IBookmarkTemplateData): IDisposable {
		const bookmarkElement = DOM.append(templateData.bookmarkContainer, document.createElement('div'));
		bookmarkElement.id = this.bookmarkType === BookmarkType.WORKSPACE ? 'workspaceBookmarkView_' + bookmark.resource.toString() : 'globalBookmarkView_' + bookmark.resource.toString();

		const focusIcon = DOM.append(bookmarkElement, document.createElement('img'));
		focusIcon.className = 'scope-tree-focus-icon-near-bookmark';

		focusIcon.addEventListener('click', () => {
			this.explorerService.setRoot(bookmark.resource);
		});

		bookmarkElement.addEventListener('mouseover', () => {
			focusIcon.style.visibility = 'visible';
		});

		bookmarkElement.addEventListener('mouseout', () => {
			focusIcon.style.visibility = 'hidden';
		});
		bookmarkElement.addEventListener('dblclick', async () => {
			await this.explorerService.select(bookmark.resource, true);	// Should also expand directory
		});

		const name = DOM.append(bookmarkElement, document.createElement('span'));
		name.textContent = bookmark.getName();

		const path = DOM.append(bookmarkElement, document.createElement('span'));
		path.className = 'bookmark-path';
		path.textContent = bookmark.getParent();

		return new BookmarkDisposable(focusIcon, name, path, bookmarkElement);
	}
}

export class BookmarksView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayBookmarksView';
	static readonly NAME = 'Bookmarks';


	private globalBookmarksTree!: WorkbenchObjectTree<Bookmark, FuzzyScore>;
	private workspaceBookmarksTree!: WorkbenchObjectTree<Bookmark, FuzzyScore>;

	private workspaceBookmarksContainer!: HTMLElement;
	private globalBookmarksContainer!: HTMLElement;

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

		this.renderGlobalBookmarks(container);
		this.renderWorkspaceBookmarks(container);

		this._register(this.bookmarksManager.onAddedBookmark(e => {
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);

		this.globalBookmarksTree.layout(height * 0.45, width);
		this.workspaceBookmarksTree.layout(height * 0.45, width);
	}

	private createTree(container: HTMLElement, scope: BookmarkType): WorkbenchObjectTree<Bookmark, FuzzyScore> {
		const tree = <WorkbenchObjectTree<Bookmark, FuzzyScore>>this.instantiationService.createInstance(
			WorkbenchObjectTree,
			'BookmarksPane' + (scope === BookmarkType.GLOBAL ? 'Global' : 'Workspace'),
			container,
			new BookmarksDelegate(),
			[new BookmarksRenderer(scope, this.explorerService)],
			{
				accessibilityProvider: {
					getAriaLabel(element: Bookmark): string {
						return element.resource.toString();
					},
					getWidgetAriaLabel(): string {
						return 'Bookmarks panel';
					}
				},
				verticalScrollMode: ScrollbarVisibility.Auto,
				keyboardNavigationLabelProvider: new BookmarkKeyboardNavigationLabelProvider()
			});
		this._register(tree);

		return tree;
	}

	private renderGlobalBookmarks(container: HTMLElement) {
		this.globalBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.GLOBAL);
		this.globalBookmarksTree = this.createTree(this.globalBookmarksContainer, BookmarkType.GLOBAL);

		const globalBookmarks = this.sortBookmarkByName(this.bookmarksManager.globalBookmarks);
		const treeItems: ITreeElement<Bookmark>[] = [];
		for (let i = 0; i < globalBookmarks.length; i++) {
			treeItems.push({
				element: new Bookmark(globalBookmarks[i])
			});
		}
		this.globalBookmarksTree.setChildren(null, treeItems);
	}

	private renderWorkspaceBookmarks(container: HTMLElement) {
		this.workspaceBookmarksContainer = this.renderBookmarksHeader(container, BookmarkType.WORKSPACE);
		this.workspaceBookmarksTree = this.createTree(this.workspaceBookmarksContainer, BookmarkType.WORKSPACE);

		const workspaceBookmarks = this.sortBookmarkByName(this.bookmarksManager.workspaceBookmarks);
		const treeItems: ITreeElement<Bookmark>[] = [];
		for (let i = 0; i < workspaceBookmarks.length; i++) {
			treeItems.push({
				element: new Bookmark(workspaceBookmarks[i])
			});
		}
		this.workspaceBookmarksTree.setChildren(null, treeItems);
	}

	private renderBookmarksHeader(container: HTMLElement, scope: BookmarkType): HTMLElement {
		const header = DOM.append(container, document.createElement('div'));
		header.className = 'bookmark-header';

		const collapsedTwistie = DOM.$(Codicon.chevronRight.cssSelector);
		const expandedTwistie = DOM.append(header, DOM.$(Codicon.chevronDown.cssSelector));
		const scopeIcon = DOM.append(header, document.createElement('img'));
		scopeIcon.className = scope === BookmarkType.WORKSPACE ? 'bookmark-header-workspace-icon' : 'bookmark-header-global-icon';

		const containerTitle = DOM.append(header, document.createElement('span'));
		containerTitle.innerText = scope === BookmarkType.WORKSPACE ? 'WORKSPACE BOOKMARKS' : 'GLOBAL BOOKMARKS';

		const bookmarksContainer = DOM.append(container, document.createElement('div'));
		bookmarksContainer.className = 'bookmarks-container';

		// Toggle twistie icon and visibility of the bookmarks
		header.onclick = () => {
			if (bookmarksContainer.style.display === 'none') {
				header.replaceChild(expandedTwistie, collapsedTwistie);
				bookmarksContainer.style.display = '';
			} else {
				header.replaceChild(collapsedTwistie, expandedTwistie);
				bookmarksContainer.style.display = 'none';
			}
		};

		return bookmarksContainer;
	}

	private sortBookmarkByName(bookmarks: Set<string>) {
		return Array.from(bookmarks).sort((path1: string, path2: string) => {
			const compare = basename(URI.parse(path1)).localeCompare(basename(URI.parse(path2)));

			// Directories with identical names are sorted by the length of their path (might need to consider alternatives)
			return compare ? compare : path1.split('/').length - path2.split('/').length;
		});
	}
}

export class BookmarkKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<Bookmark> {
	getKeyboardNavigationLabel(element: Bookmark): { toString(): string } {
		return element.getName();
	}
}
