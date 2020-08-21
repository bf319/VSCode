/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';

export class RecentDirectoriesView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayRecentDirectories';
	static readonly NAME = 'Recent directories';
}
