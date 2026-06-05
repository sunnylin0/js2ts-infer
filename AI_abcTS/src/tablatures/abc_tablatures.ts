import AbcStringTab from './instruments/tab-string';

const pluginTab: Record<string, { name: string; defaultTuning: string[]; isTabBig: boolean; tabSymbolOffset: number }> = {
	'violin': { name: 'StringTab', defaultTuning: ['G,', 'D', 'A', 'e'], isTabBig: false, tabSymbolOffset: 0 },
	'fiddle': { name: 'StringTab', defaultTuning: ['G,', 'D', 'A', 'e'], isTabBig: false, tabSymbolOffset: 0 },
	'mandolin': { name: 'StringTab', defaultTuning: ['G,', 'D', 'A', 'e'], isTabBig: false, tabSymbolOffset: 0 },
	'guitar': { name: 'StringTab', defaultTuning: ['E,', 'A,', 'D', 'G', 'B', 'e'], isTabBig: true, tabSymbolOffset: 0 },
	'fiveString': { name: 'StringTab', defaultTuning: ['C,', 'G,', 'D', 'A', 'e'], isTabBig: false, tabSymbolOffset: -.95 },
};

const abcTablatures = {
	inited: false,
	plugins: {} as Record<string, any>,

	register: function (plugin: { name: string; tablature: any }) {
		const name = plugin.name;
		const tablature = plugin.tablature;
		this.plugins[name] = tablature;
	},

	setError: function (tune: any, msg: string) {
		if (tune.warnings) {
			tune.warnings.push(msg);
		} else {
			tune.warnings = [msg];
		}
	},

	preparePlugins: function (tune: any, tuneNumber: number, params: any): any[] | null {
		if (!this.inited) {
			this.register(AbcStringTab());
			this.inited = true;
		}
		let returned: any[] | null = null;
		if (params.tablature) {
			const tabs = params.tablature;
			returned = [];
			for (let ii = 0; ii < tabs.length; ii++) {
				const args = tabs[ii];
				const instrument = args['instrument'];
				if (instrument == null) {
					this.setError(tune, "tablature 'instrument' is missing");
					return returned;
				}
				const tabSettings = pluginTab[instrument];
				let plugin: any = null;
				if (tabSettings) {
					plugin = this.plugins[tabSettings.name];
				}
				if (plugin) {
					if (params.visualTranspose !== 0) {
						args.visualTranspose = params.visualTranspose;
					}
					args.abcSrc = params.tablature.abcSrc;
					const pluginInstance = {
						classz: plugin,
						tuneNumber: tuneNumber,
						params: args,
						instance: null as any,
						tabType: tabSettings,
					};
					returned.push(pluginInstance);
				} else if (instrument === '') {
					returned.push(null);
				} else {
					this.setError(tune, `Undefined tablature plugin: ${instrument}`);
					return returned;
				}
			}
		}
		return returned;
	},

	layoutTablatures: function (renderer: any, abcTune: any) {
		const tabs = abcTune.tablatures;
		let staffLineCount = 0;

		if (tabs && tabs.length > 0) {
			for (let kk = 0; kk < tabs.length; kk++) {
				if (tabs[kk] && tabs[kk].params.firstStaffOnly) {
					tabs[kk].params.suppress = false;
				}
			}
		}

		for (let ii = 0; ii < abcTune.lines.length; ii++) {
			const line = abcTune.lines[ii];
			if (line.staff) {
				staffLineCount++;
			}

			if (staffLineCount > 1) {
				if (tabs && tabs.length > 0) {
					for (let kk = 0; kk < tabs.length; kk++) {
						if (tabs[kk] && tabs[kk].params.firstStaffOnly) {
							tabs[kk].params.suppress = true;
						}
					}
				}
			}

			const curStaff = line.staff;
			if (curStaff) {
				const maxStaves = curStaff.length;
				for (let jj = 0; jj < curStaff.length; jj++) {
					if (tabs && tabs[jj] && jj < maxStaves) {
						const tabPlugin = tabs[jj];
						if (tabPlugin.instance == null) {
							tabPlugin.instance = new tabPlugin.classz();
							tabPlugin.instance.init(
								abcTune,
								tabPlugin.tuneNumber,
								tabPlugin.params,
								tabPlugin.tabType
							);
						}
						tabPlugin.instance.render(renderer, line, jj);
					}
				}
			}
		}
	},
};

export default abcTablatures;
