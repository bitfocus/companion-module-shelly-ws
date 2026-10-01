class ShellyRelayMaster {
	constructor(relayCount, inputCount, sendRequest) {
		this.relayCount = relayCount
		this.inputCount = inputCount
		this.sendRequest = sendRequest

		this.relayStates = []
		this.inputStates = []
		this.relayTempsCelsius = []
		this.relayTempsFahrenheit = []
	}

	parseIncomingData(data) {
		if (data.result != null) {
			for (let i = 0; i < this.relayCount; i++) {
				const switchKey = `switch:${i}`
				if (data.result[switchKey] !== undefined) {
					const switchData = data.result[switchKey]

					if (switchData.output !== undefined) {
						this.relayStates[i] = switchData.output
					}
					if (switchData.temperature !== undefined) {
						this.relayTempsCelsius[i] = switchData.temperature.tC
						this.relayTempsFahrenheit[i] = switchData.temperature.tF
					}
				}
			}
		}
		if (data.method == 'NotifyStatus') {
			for (let i = 0; i < this.relayCount; i++) {
				const switchKey = `switch:${i}`
				if (data.params[switchKey]) {
					if (data.params[switchKey].output !== undefined) {
						this.relayStates[i] = data.params[switchKey].output
					}
					if (data.params[switchKey].temperature !== undefined) {
						this.relayTempsCelsius[i] = data.params[switchKey].temperature.tC
						this.relayTempsFahrenheit[i] = data.params[switchKey].temperature.tF
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	switchRelay(relayId, state) {
		this.sendRequest('Switch.Set', {
			id: relayId,
			on: state == 0 ? true : false,
		})
	}

	getVariableValues() {
		const variableValues = {}

		// Relay states
		for (let i = 0; i < this.relayCount; i++) {
			variableValues[`relay_${i + 1}_state`] = this.relayStates[i]
			variableValues[`relay_${i + 1}_temp_c`] = this.relayTempsCelsius[i]
			variableValues[`relay_${i + 1}_temp_f`] = this.relayTempsFahrenheit[i]
		}

		// Input states
		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		for (let i = 0; i < this.relayCount; i++) {
			variables.push({
				name: `Relay ${i + 1} State`,
				variableId: `relay_${i + 1}_state`,
			})
			variables.push({
				name: `Relay ${i + 1} Temperature (°C)`,
				variableId: `relay_${i + 1}_temp_c`,
			})
			variables.push({
				name: `Relay ${i + 1} Temperature (°F)`,
				variableId: `relay_${i + 1}_temp_f`,
			})
		}

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getFeedbackDefinitions() {
		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		const relayOptions = Array.from({ length: this.relayCount }, (_, index) => ({
			id: index,
			label: `Relay ${index + 1}`,
		}))

		return {
			relayState: {
				type: 'boolean',
				name: 'Relay state',
				description: 'Get the state of a relay',
				options: [
					{
						type: 'dropdown',
						label: 'Relay',
						id: 'selectedRelay',
						default: 0,
						choices: relayOptions,
					},
				],
				callback: (feedback) => {
					return this.relayStates[feedback.options.selectedRelay]
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
			relayTemp: {
				type: 'advanced',
				name: 'Relay temperature',
				description: 'Get the temperature of a relay',
				options: [
					{
						type: 'dropdown',
						label: 'Relay',
						id: 'selectedRelay',
						default: 0,
						choices: relayOptions,
					},
					{
						type: 'dropdown',
						label: 'Temperature format',
						id: 'selectedTempFormat',
						default: 0,
						choices: [
							{ id: 0, label: 'Celsius' },
							{ id: 1, label: 'Fahrenheit' },
						],
					},
				],
				callback: (feedback) => {
					switch (feedback.options.selectedTempFormat) {
						case 0:
							return {
								text: this.relayTempsCelsius[feedback.options.selectedRelay],
							}
						case 1:
							return {
								text: this.relayTempsFahrenheit[feedback.options.selectedRelay],
							}
						default:
							return {
								text: this.relayTempsCelsius[feedback.options.selectedRelay],
							}
					}
				},
			},
		}
	}

	getActionDefinitions() {
		const relayOptions = Array.from({ length: this.relayCount }, (_, index) => ({
			id: index,
			label: `Relay ${index + 1}`,
		}))

		const stateOptions = [
			{ id: 0, label: 'On' },
			{ id: 1, label: 'Off' },
		]

		return {
			switchRelay: {
				name: 'Set relay state',
				description: 'Turn on/off a relay',
				options: [
					{
						type: 'dropdown',
						label: 'Relay',
						id: 'selectedRelay',
						default: 0,
						choices: relayOptions,
					},
					{
						type: 'dropdown',
						label: 'Relay State',
						id: 'selectedRelayState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.switchRelay(action.options.selectedRelay, action.options.selectedRelayState)
				},
			},
			toggleRelay: {
				name: 'Toggle relay state',
				description: 'Toggle a relay',
				options: [
					{
						type: 'dropdown',
						label: 'Relay',
						id: 'selectedRelay',
						default: 0,
						choices: relayOptions,
					},
				],
				callback: async (action) => {
					if (this.relayStates[action.options.selectedRelay] === undefined) {
						this.relayStates[action.options.selectedRelay] = false
					}
					const targetState = this.relayStates[action.options.selectedRelay] == true ? 1 : 0
					this.switchRelay(action.options.selectedRelay, targetState)
				},
			},
		}
	}
}

class ShellyRelayMasterPM extends ShellyRelayMaster {
	constructor(relayCount, inputCount, sendRequest) {
		super(relayCount, inputCount, sendRequest)
		this.powerConsumptions = []
		this.overpowerStates = []
	}

	parseIncomingData(data) {
		super.parseIncomingData(data)
		if (data.result != null) {
			for (let i = 0; i < this.relayCount; i++) {
				const switchKey = `switch:${i}`
				const switchData = data.result[switchKey]

				if (switchData !== null && switchData?.apower !== undefined) {
					this.powerConsumptions[i] = switchData.apower
				}
			}
		}
		if (data.method != null && data.method == 'NotifyStatus') {
			for (let i = 0; i < this.relayCount; i++) {
				const switchKey = `switch:${i}`
				const switchData = data.params[switchKey]

				if (switchData !== null && switchData?.apower !== undefined) {
					this.powerConsumptions[i] = switchData.apower
				}
			}
		}
	}

	getVariableValues() {
		const existingValues = super.getVariableValues()
		const variableValues = {}

		// Relay states
		for (let i = 0; i < this.relayCount; i++) {
			variableValues[`relay_${i + 1}_consumption`] = this.powerConsumptions[i]
			variableValues[`relay_${i + 1}_overpower`] = this.overpowerStates[i]
		}

		// Input states
		// Input states are handled by super.getVariableValues()

		return { ...existingValues, ...variableValues }
	}

	getVariableDefinitions() {
		const existingVars = super.getVariableDefinitions()
		const variables = []

		// Relay States
		for (let i = 0; i < this.relayCount; i++) {
			variables.push({
				name: `Relay ${i + 1} Power Consumption`,
				variableId: `relay_${i + 1}_consumption`,
			})
			variables.push({
				name: `Relay ${i + 1} Overpower State`,
				variableId: `relay_${i + 1}_overpower`,
			})
		}

		return [...existingVars, ...variables]
	}

	getFeedbackDefinitions() {
		const relayOptions = Array.from({ length: this.relayCount }, (_, index) => ({
			id: index,
			label: `Relay ${index + 1}`,
		}))
		const newFeedbacks = {
			powerConsumption: {
				type: 'advanced',
				name: 'Power consumption',
				description: 'Displays the current power consumption of a relay',
				options: [
					{
						type: 'dropdown',
						label: 'Relay',
						id: 'selectedRelay',
						default: 0,
						choices: relayOptions,
					},
				],
				callback: (feedback) => {
					return {
						text: this.powerConsumptions[feedback.options.selectedRelay] + ' W',
					}
				},
			},
		}
		const oldFeedbacks = super.getFeedbackDefinitions()
		Object.assign(oldFeedbacks, newFeedbacks)
		return oldFeedbacks
	}
}

class ShellyMasterCover {
	constructor(coverCount, inputCount, sendRequest) {
		this.coverCount = coverCount
		this.inputCount = inputCount
		this.sendRequest = sendRequest
		this.coverPositions = []
		this.coverStates = []
		this.powerConsumptions = []
		this.inputStates = []
	}

	getVariableDefinitions() {
		const variables = []

		for (let i = 0; i < this.coverCount; i++) {
			variables.push({
				name: `Cover ${i + 1} State`,
				variableId: `cover_${i + 1}_state`,
			})
			variables.push({
				name: `Cover ${i + 1} Position`,
				variableId: `cover_${i + 1}_position`,
			})
			variables.push({
				name: `Cover ${i + 1} Power Consumption`,
				variableId: `cover_${i + 1}_consumption`,
			})
		}

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getVariableValues() {
		const variableValues = {}

		for (let i = 0; i < this.coverCount; i++) {
			variableValues[`cover_${i + 1}_state`] = this.coverStates[i]
			variableValues[`cover_${i + 1}_position`] = this.coverPositions[i]
			variableValues[`cover_${i + 1}_consumption`] = this.powerConsumptions[i]
		}

		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	parseIncomingData(data) {
		if (data.result != null) {
			for (let i = 0; i < this.coverCount; i++) {
				const coverKey = `cover:${i}`
				const coverData = data.result[coverKey]

				if (coverData !== null && coverData?.current_pos !== undefined) {
					this.coverPositions[i] = coverData.current_pos
				}
				if (coverData !== null && coverData?.state !== undefined) {
					this.coverStates[i] = coverData.state
				}
				if (coverData !== null && coverData?.apower !== undefined) {
					this.powerConsumptions[i] = coverData.apower
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method != null && data.method == 'NotifyStatus') {
			for (let i = 0; i < this.coverCount; i++) {
				const coverKey = `cover:${i}`
				const coverData = data.params[coverKey]

				if (coverData !== null && coverData?.apower !== undefined) {
					this.powerConsumptions[i] = coverData.apower
				}
				if (coverData !== null && coverData?.current_pos !== undefined) {
					this.coverPositions[i] = coverData.current_pos
				}
				if (coverData !== null && coverData?.state !== undefined) {
					this.coverStates[i] = coverData.state
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	openCover(coverId) {
		this.sendRequest('Cover.Open', {
			id: coverId,
		})
	}

	closeCover(coverId) {
		this.sendRequest('Cover.Close', {
			id: coverId,
		})
	}
	stopCover(coverId) {
		this.sendRequest('Cover.Stop', {
			id: coverId,
		})
	}
	goToPosition(coverId, pos) {
		this.sendRequest('Cover.GoToPosition', {
			id: coverId,
			pos: pos,
		})
	}

	getActionDefinitions() {
		const coverOptions = Array.from({ length: this.coverCount }, (_, index) => ({
			id: index,
			label: `Cover ${index + 1}`,
		}))

		const actionOptions = [
			{ id: 0, label: 'Open' },
			{ id: 1, label: 'Close' },
			{ id: 2, label: 'Stop' },
		]

		return {
			moveCover: {
				name: 'Open/Close/Stop Cover',
				description: 'Open, Close or Stop a cover',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
					{
						type: 'dropdown',
						label: 'Action',
						id: 'selectedAction',
						default: 0,
						choices: actionOptions,
					},
				],
				callback: async (action) => {
					switch (action.options.selectedAction) {
						case 0:
							this.openCover(action.options.selectedCover)
							break
						case 1:
							this.closeCover(action.options.selectedCover)
							break
						case 2:
							this.stopCover(action.options.selectedCover)
							break
					}
				},
			},
			goToPos: {
				name: 'Go to position',
				description: 'Move the cover to a specific position',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
					{
						type: 'number',
						label: 'Position (%)',
						id: 'targetPosition',
						default: 50,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.goToPosition(action.options.selectedCover, action.options.targetPosition)
				},
			},
		}
	}

	getFeedbackDefinitions() {
		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		const coverOptions = Array.from({ length: this.coverCount }, (_, index) => ({
			id: index,
			label: `Cover ${index + 1}`,
		}))

		const coverStateOptions = [
			{ id: 0, label: 'Opening' },
			{ id: 1, label: 'Open' },
			{ id: 2, label: 'Closing' },
			{ id: 3, label: 'Closed' },
			{ id: 4, label: 'Stopped' },
		]

		return {
			coverPosition: {
				type: 'advanced',
				name: 'Cover position',
				description: 'Get the current position of a cover',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
				],
				callback: (feedback) => {
					return {
						text: this.coverPositions[feedback.options.selectedCover] + '%',
					}
				},
			},
			coverState: {
				type: 'advanced',
				name: 'Cover state',
				description: 'Display the current state of a cover',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.coverStates[feedback.options.selectedCover] }
				},
			},
			coverStateBool: {
				type: 'boolean',
				name: 'Cover state boolean',
				description: 'Check different cover states',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
					{
						type: 'dropdown',
						label: 'Trigger on state',
						id: 'selectedCoverState',
						default: 0,
						choices: coverStateOptions,
					},
				],
				callback: (feedback) => {
					switch (feedback.options.selectedCoverState) {
						case 0:
							return this.coverStates[feedback.options.selectedCover] == 'opening' ? true : false
						case 1:
							return this.coverStates[feedback.options.selectedCover] == 'open' ? true : false
						case 2:
							return this.coverStates[feedback.options.selectedCover] == 'closing' ? true : false
						case 3:
							return this.coverStates[feedback.options.selectedCover] == 'closed' ? true : false
						case 4:
							return this.coverStates[feedback.options.selectedCover] == 'stopped' ? true : false
					}
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
			powerConsumption: {
				type: 'advanced',
				name: 'Power consumption',
				description: 'Displays the current power consumption of a cover',
				options: [
					{
						type: 'dropdown',
						label: 'Cover',
						id: 'selectedCover',
						default: 0,
						choices: coverOptions,
					},
				],
				callback: (feedback) => {
					return {
						text: this.powerConsumptions[feedback.options.selectedCover] + ' W',
					}
				},
			},
		}
	}
}

class ShellyMasterInput {
	constructor(inputCount, sendRequest) {
		this.inputCount = inputCount
		this.sendRequest = sendRequest
		this.inputStates = []
	}

	parseIncomingData(data) {
		if (data.result != null) {
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method != null && data.method == 'NotifyStatus') {
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	getVariableValues() {
		const variableValues = {}

		// Input states
		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		// Input states
		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getActionDefinitions() {
		return {}
	}

	getFeedbackDefinitions() {
		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))
		return {
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
		}
	}
}

class ShellyMasterRGBCCT {
	constructor(inputCount, sendRequest) {
		this.inputCount = inputCount
		this.sendRequest = sendRequest

		this.rgbState = undefined
		this.rgbColor = [undefined, undefined, undefined]
		this.rgbBrightness = undefined
		this.rgbPower = undefined
		this.rgbTempCelsius = undefined
		this.rgbTempFahrenheit = undefined

		this.cctState = undefined
		this.cctBrightness = undefined
		this.cctTemperature = undefined
		this.cctPower = undefined
		this.cctTempCelsius = undefined
		this.cctTempFahrenheit = undefined

		this.inputStates = []
	}

	parseComponentData(rgbData, cctData) {
		if (rgbData != null) {
			if (rgbData.output !== undefined) {
				this.rgbState = rgbData.output
			}
			if (rgbData.rgb !== undefined) {
				this.rgbColor = rgbData.rgb
			}
			if (rgbData.brightness !== undefined) {
				this.rgbBrightness = rgbData.brightness
			}
			if (rgbData.apower !== undefined) {
				this.rgbPower = rgbData.apower
			}
			if (rgbData.temperature !== undefined) {
				this.rgbTempCelsius = rgbData.temperature.tC
				this.rgbTempFahrenheit = rgbData.temperature.tF
			}
		}
		if (cctData != null) {
			if (cctData.output !== undefined) {
				this.cctState = cctData.output
			}
			if (cctData.brightness !== undefined) {
				this.cctBrightness = cctData.brightness
			}
			if (cctData.ct !== undefined) {
				this.cctTemperature = cctData.ct
			}
			if (cctData.apower !== undefined) {
				this.cctPower = cctData.apower
			}
			if (cctData.temperature !== undefined) {
				this.cctTempCelsius = cctData.temperature.tC
				this.cctTempFahrenheit = cctData.temperature.tF
			}
		}
	}

	parseIncomingData(data) {
		if (data.result != null) {
			this.parseComponentData(data.result['rgb:0'], data.result['cct:0'])
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method == 'NotifyStatus') {
			this.parseComponentData(data.params['rgb:0'], data.params['cct:0'])
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	setRgbState(state) {
		this.sendRequest('RGB.Set', {
			id: 0,
			on: state == 0 ? true : false,
		})
	}

	setRgbColor(r, g, b) {
		this.sendRequest('RGB.Set', {
			id: 0,
			rgb: [r, g, b],
		})
	}

	setRgbBrightness(brightness) {
		this.sendRequest('RGB.Set', {
			id: 0,
			brightness: brightness,
		})
	}

	setCctState(state) {
		this.sendRequest('CCT.Set', {
			id: 0,
			on: state == 0 ? true : false,
		})
	}

	setCctBrightness(brightness) {
		this.sendRequest('CCT.Set', {
			id: 0,
			brightness: brightness,
		})
	}

	setCctTemperature(ct) {
		this.sendRequest('CCT.Set', {
			id: 0,
			ct: ct,
		})
	}

	getVariableValues() {
		const variableValues = {}

		variableValues['rgb_state'] = this.rgbState
		variableValues['rgb_red'] = this.rgbColor[0]
		variableValues['rgb_green'] = this.rgbColor[1]
		variableValues['rgb_blue'] = this.rgbColor[2]
		variableValues['rgb_brightness'] = this.rgbBrightness
		variableValues['rgb_consumption'] = this.rgbPower
		variableValues['rgb_temp_c'] = this.rgbTempCelsius
		variableValues['rgb_temp_f'] = this.rgbTempFahrenheit

		variableValues['cct_state'] = this.cctState
		variableValues['cct_brightness'] = this.cctBrightness
		variableValues['cct_temperature'] = this.cctTemperature
		variableValues['cct_consumption'] = this.cctPower
		variableValues['cct_temp_c'] = this.cctTempCelsius
		variableValues['cct_temp_f'] = this.cctTempFahrenheit

		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		variables.push({ name: 'RGB State', variableId: 'rgb_state' })
		variables.push({ name: 'RGB Red', variableId: 'rgb_red' })
		variables.push({ name: 'RGB Green', variableId: 'rgb_green' })
		variables.push({ name: 'RGB Blue', variableId: 'rgb_blue' })
		variables.push({ name: 'RGB Brightness', variableId: 'rgb_brightness' })
		variables.push({ name: 'RGB Power Consumption', variableId: 'rgb_consumption' })
		variables.push({ name: 'RGB Temperature (°C)', variableId: 'rgb_temp_c' })
		variables.push({ name: 'RGB Temperature (°F)', variableId: 'rgb_temp_f' })

		variables.push({ name: 'CCT State', variableId: 'cct_state' })
		variables.push({ name: 'CCT Brightness', variableId: 'cct_brightness' })
		variables.push({ name: 'CCT Color Temperature (K)', variableId: 'cct_temperature' })
		variables.push({ name: 'CCT Power Consumption', variableId: 'cct_consumption' })
		variables.push({ name: 'CCT Temperature (°C)', variableId: 'cct_temp_c' })
		variables.push({ name: 'CCT Temperature (°F)', variableId: 'cct_temp_f' })

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getFeedbackDefinitions() {
		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		return {
			rgbState: {
				type: 'boolean',
				name: 'RGB state',
				description: 'Get the on/off state of the RGB channel',
				options: [],
				callback: () => {
					return this.rgbState
				},
			},
			rgbColor: {
				type: 'advanced',
				name: 'RGB color',
				description: 'Displays the current RGB color as the button background color',
				options: [],
				callback: () => {
					const [r, g, b] = this.rgbColor
					return {
						bgcolor: ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0),
					}
				},
			},
			rgbBrightness: {
				type: 'advanced',
				name: 'RGB brightness',
				description: 'Displays the current RGB brightness',
				options: [],
				callback: () => {
					return { text: this.rgbBrightness + '%' }
				},
			},
			rgbPowerConsumption: {
				type: 'advanced',
				name: 'RGB power consumption',
				description: 'Displays the current power consumption of the RGB channel',
				options: [],
				callback: () => {
					return { text: this.rgbPower + ' W' }
				},
			},
			cctState: {
				type: 'boolean',
				name: 'CCT state',
				description: 'Get the on/off state of the CCT (white) channel',
				options: [],
				callback: () => {
					return this.cctState
				},
			},
			cctBrightness: {
				type: 'advanced',
				name: 'CCT brightness',
				description: 'Displays the current CCT brightness',
				options: [],
				callback: () => {
					return { text: this.cctBrightness + '%' }
				},
			},
			cctTemperature: {
				type: 'advanced',
				name: 'CCT color temperature',
				description: 'Displays the current CCT color temperature',
				options: [],
				callback: () => {
					return { text: this.cctTemperature + ' K' }
				},
			},
			cctPowerConsumption: {
				type: 'advanced',
				name: 'CCT power consumption',
				description: 'Displays the current power consumption of the CCT channel',
				options: [],
				callback: () => {
					return { text: this.cctPower + ' W' }
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
		}
	}

	getActionDefinitions() {
		const stateOptions = [
			{ id: 0, label: 'On' },
			{ id: 1, label: 'Off' },
		]

		return {
			setRgbState: {
				name: 'RGB: Set state',
				description: 'Turn the RGB channel on or off',
				options: [
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setRgbState(action.options.selectedState)
				},
			},
			toggleRgbState: {
				name: 'RGB: Toggle state',
				description: 'Toggle the RGB channel on/off',
				options: [],
				callback: async () => {
					if (this.rgbState === undefined) {
						this.rgbState = false
					}
					const targetState = this.rgbState == true ? 1 : 0
					this.setRgbState(targetState)
				},
			},
			setRgbColor: {
				name: 'RGB: Set color',
				description: 'Set the RGB color',
				options: [
					{
						type: 'colorpicker',
						label: 'Color',
						id: 'selectedColor',
						default: 0xff0000,
						enableAlpha: false,
					},
				],
				callback: async (action) => {
					const color = action.options.selectedColor
					const r = (color >> 16) & 0xff
					const g = (color >> 8) & 0xff
					const b = color & 0xff
					this.setRgbColor(r, g, b)
				},
			},
			setRgbBrightness: {
				name: 'RGB: Set brightness',
				description: 'Set the brightness of the RGB channel',
				options: [
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setRgbBrightness(action.options.selectedBrightness)
				},
			},
			setCctState: {
				name: 'CCT: Set state',
				description: 'Turn the CCT (white) channel on or off',
				options: [
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setCctState(action.options.selectedState)
				},
			},
			toggleCctState: {
				name: 'CCT: Toggle state',
				description: 'Toggle the CCT (white) channel on/off',
				options: [],
				callback: async () => {
					if (this.cctState === undefined) {
						this.cctState = false
					}
					const targetState = this.cctState == true ? 1 : 0
					this.setCctState(targetState)
				},
			},
			setCctBrightness: {
				name: 'CCT: Set brightness',
				description: 'Set the brightness of the CCT (white) channel',
				options: [
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setCctBrightness(action.options.selectedBrightness)
				},
			},
			setCctTemperature: {
				name: 'CCT: Set color temperature',
				description: 'Set the white color temperature',
				options: [
					{
						type: 'number',
						label: 'Temperature (K)',
						id: 'selectedTemperature',
						default: 4000,
						min: 3000,
						max: 6500,
					},
				],
				callback: async (action) => {
					this.setCctTemperature(action.options.selectedTemperature)
				},
			},
		}
	}
}

class ShellyMasterLight {
	constructor(lightCount, inputCount, sendRequest) {
		this.lightCount = lightCount
		this.inputCount = inputCount
		this.sendRequest = sendRequest

		this.lightStates = []
		this.lightBrightness = []
		this.lightPower = []
		this.inputStates = []
	}

	parseIncomingData(data) {
		if (data.result != null) {
			for (let i = 0; i < this.lightCount; i++) {
				const lightKey = `light:${i}`
				const lightData = data.result[lightKey]

				if (lightData != null) {
					if (lightData.output !== undefined) {
						this.lightStates[i] = lightData.output
					}
					if (lightData.brightness !== undefined) {
						this.lightBrightness[i] = lightData.brightness
					}
					if (lightData.apower !== undefined) {
						this.lightPower[i] = lightData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method == 'NotifyStatus') {
			for (let i = 0; i < this.lightCount; i++) {
				const lightKey = `light:${i}`
				const lightData = data.params[lightKey]

				if (lightData != null) {
					if (lightData.output !== undefined) {
						this.lightStates[i] = lightData.output
					}
					if (lightData.brightness !== undefined) {
						this.lightBrightness[i] = lightData.brightness
					}
					if (lightData.apower !== undefined) {
						this.lightPower[i] = lightData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	setLightState(lightId, state) {
		this.sendRequest('Light.Set', {
			id: lightId,
			on: state == 0 ? true : false,
		})
	}

	setLightBrightness(lightId, brightness) {
		this.sendRequest('Light.Set', {
			id: lightId,
			brightness: brightness,
		})
	}

	getVariableValues() {
		const variableValues = {}

		for (let i = 0; i < this.lightCount; i++) {
			variableValues[`light_${i + 1}_state`] = this.lightStates[i]
			variableValues[`light_${i + 1}_brightness`] = this.lightBrightness[i]
			variableValues[`light_${i + 1}_consumption`] = this.lightPower[i]
		}

		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		for (let i = 0; i < this.lightCount; i++) {
			variables.push({
				name: `Light ${i + 1} State`,
				variableId: `light_${i + 1}_state`,
			})
			variables.push({
				name: `Light ${i + 1} Brightness`,
				variableId: `light_${i + 1}_brightness`,
			})
			variables.push({
				name: `Light ${i + 1} Power Consumption`,
				variableId: `light_${i + 1}_consumption`,
			})
		}

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getFeedbackDefinitions() {
		const lightOptions = Array.from({ length: this.lightCount }, (_, index) => ({
			id: index,
			label: `Light ${index + 1}`,
		}))

		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		return {
			lightState: {
				type: 'boolean',
				name: 'Light state',
				description: 'Get the state of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return this.lightStates[feedback.options.selectedLight]
				},
			},
			lightBrightness: {
				type: 'advanced',
				name: 'Light brightness',
				description: 'Displays the current brightness of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.lightBrightness[feedback.options.selectedLight] + '%' }
				},
			},
			lightPowerConsumption: {
				type: 'advanced',
				name: 'Light power consumption',
				description: 'Displays the current power consumption of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.lightPower[feedback.options.selectedLight] + ' W' }
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
		}
	}

	getActionDefinitions() {
		const lightOptions = Array.from({ length: this.lightCount }, (_, index) => ({
			id: index,
			label: `Light ${index + 1}`,
		}))

		const stateOptions = [
			{ id: 0, label: 'On' },
			{ id: 1, label: 'Off' },
		]

		return {
			setLightState: {
				name: 'Set light state',
				description: 'Turn on/off a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setLightState(action.options.selectedLight, action.options.selectedState)
				},
			},
			toggleLight: {
				name: 'Toggle light state',
				description: 'Toggle a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: async (action) => {
					if (this.lightStates[action.options.selectedLight] === undefined) {
						this.lightStates[action.options.selectedLight] = false
					}
					const targetState = this.lightStates[action.options.selectedLight] == true ? 1 : 0
					this.setLightState(action.options.selectedLight, targetState)
				},
			},
			setLightBrightness: {
				name: 'Set light brightness',
				description: 'Set the brightness of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setLightBrightness(action.options.selectedLight, action.options.selectedBrightness)
				},
			},
		}
	}
}

class ShellyMasterCCT {
	constructor(cctCount, inputCount, sendRequest) {
		this.cctCount = cctCount
		this.inputCount = inputCount
		this.sendRequest = sendRequest

		this.cctStates = []
		this.cctBrightness = []
		this.cctTemperatures = []
		this.cctPower = []
		this.inputStates = []
	}

	parseIncomingData(data) {
		if (data.result != null) {
			for (let i = 0; i < this.cctCount; i++) {
				const cctKey = `cct:${i}`
				const cctData = data.result[cctKey]

				if (cctData != null) {
					if (cctData.output !== undefined) {
						this.cctStates[i] = cctData.output
					}
					if (cctData.brightness !== undefined) {
						this.cctBrightness[i] = cctData.brightness
					}
					if (cctData.ct !== undefined) {
						this.cctTemperatures[i] = cctData.ct
					}
					if (cctData.apower !== undefined) {
						this.cctPower[i] = cctData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method == 'NotifyStatus') {
			for (let i = 0; i < this.cctCount; i++) {
				const cctKey = `cct:${i}`
				const cctData = data.params[cctKey]

				if (cctData != null) {
					if (cctData.output !== undefined) {
						this.cctStates[i] = cctData.output
					}
					if (cctData.brightness !== undefined) {
						this.cctBrightness[i] = cctData.brightness
					}
					if (cctData.ct !== undefined) {
						this.cctTemperatures[i] = cctData.ct
					}
					if (cctData.apower !== undefined) {
						this.cctPower[i] = cctData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	setCctState(cctId, state) {
		this.sendRequest('CCT.Set', {
			id: cctId,
			on: state == 0 ? true : false,
		})
	}

	setCctBrightness(cctId, brightness) {
		this.sendRequest('CCT.Set', {
			id: cctId,
			brightness: brightness,
		})
	}

	setCctTemperature(cctId, ct) {
		this.sendRequest('CCT.Set', {
			id: cctId,
			ct: ct,
		})
	}

	getVariableValues() {
		const variableValues = {}

		for (let i = 0; i < this.cctCount; i++) {
			variableValues[`cct_${i + 1}_state`] = this.cctStates[i]
			variableValues[`cct_${i + 1}_brightness`] = this.cctBrightness[i]
			variableValues[`cct_${i + 1}_temperature`] = this.cctTemperatures[i]
			variableValues[`cct_${i + 1}_consumption`] = this.cctPower[i]
		}

		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		for (let i = 0; i < this.cctCount; i++) {
			variables.push({
				name: `CCT ${i + 1} State`,
				variableId: `cct_${i + 1}_state`,
			})
			variables.push({
				name: `CCT ${i + 1} Brightness`,
				variableId: `cct_${i + 1}_brightness`,
			})
			variables.push({
				name: `CCT ${i + 1} Color Temperature (K)`,
				variableId: `cct_${i + 1}_temperature`,
			})
			variables.push({
				name: `CCT ${i + 1} Power Consumption`,
				variableId: `cct_${i + 1}_consumption`,
			})
		}

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getFeedbackDefinitions() {
		const cctOptions = Array.from({ length: this.cctCount }, (_, index) => ({
			id: index,
			label: `CCT ${index + 1}`,
		}))

		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		return {
			cctState: {
				type: 'boolean',
				name: 'CCT state',
				description: 'Get the on/off state of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
				],
				callback: (feedback) => {
					return this.cctStates[feedback.options.selectedCct]
				},
			},
			cctBrightness: {
				type: 'advanced',
				name: 'CCT brightness',
				description: 'Displays the current brightness of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.cctBrightness[feedback.options.selectedCct] + '%' }
				},
			},
			cctTemperature: {
				type: 'advanced',
				name: 'CCT color temperature',
				description: 'Displays the current color temperature of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.cctTemperatures[feedback.options.selectedCct] + ' K' }
				},
			},
			cctPowerConsumption: {
				type: 'advanced',
				name: 'CCT power consumption',
				description: 'Displays the current power consumption of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.cctPower[feedback.options.selectedCct] + ' W' }
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
		}
	}

	getActionDefinitions() {
		const cctOptions = Array.from({ length: this.cctCount }, (_, index) => ({
			id: index,
			label: `CCT ${index + 1}`,
		}))

		const stateOptions = [
			{ id: 0, label: 'On' },
			{ id: 1, label: 'Off' },
		]

		return {
			setCctState: {
				name: 'Set CCT state',
				description: 'Turn a CCT channel on or off',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setCctState(action.options.selectedCct, action.options.selectedState)
				},
			},
			toggleCctState: {
				name: 'Toggle CCT state',
				description: 'Toggle a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
				],
				callback: async (action) => {
					if (this.cctStates[action.options.selectedCct] === undefined) {
						this.cctStates[action.options.selectedCct] = false
					}
					const targetState = this.cctStates[action.options.selectedCct] == true ? 1 : 0
					this.setCctState(action.options.selectedCct, targetState)
				},
			},
			setCctBrightness: {
				name: 'Set CCT brightness',
				description: 'Set the brightness of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setCctBrightness(action.options.selectedCct, action.options.selectedBrightness)
				},
			},
			setCctTemperature: {
				name: 'Set CCT color temperature',
				description: 'Set the color temperature of a CCT channel',
				options: [
					{
						type: 'dropdown',
						label: 'CCT',
						id: 'selectedCct',
						default: 0,
						choices: cctOptions,
					},
					{
						type: 'number',
						label: 'Temperature (K)',
						id: 'selectedTemperature',
						default: 4000,
						min: 3000,
						max: 6500,
					},
				],
				callback: async (action) => {
					this.setCctTemperature(action.options.selectedCct, action.options.selectedTemperature)
				},
			},
		}
	}
}

class ShellyMasterRGBLight {
	constructor(lightCount, inputCount, sendRequest) {
		this.lightCount = lightCount
		this.inputCount = inputCount
		this.sendRequest = sendRequest

		this.rgbState = undefined
		this.rgbColor = [undefined, undefined, undefined]
		this.rgbBrightness = undefined
		this.rgbPower = undefined
		this.rgbTempCelsius = undefined
		this.rgbTempFahrenheit = undefined

		this.lightStates = []
		this.lightBrightness = []
		this.lightPower = []
		this.inputStates = []
	}

	parseRgbData(rgbData) {
		if (rgbData == null) {
			return
		}
		if (rgbData.output !== undefined) {
			this.rgbState = rgbData.output
		}
		if (rgbData.rgb !== undefined) {
			this.rgbColor = rgbData.rgb
		}
		if (rgbData.brightness !== undefined) {
			this.rgbBrightness = rgbData.brightness
		}
		if (rgbData.apower !== undefined) {
			this.rgbPower = rgbData.apower
		}
		if (rgbData.temperature !== undefined) {
			this.rgbTempCelsius = rgbData.temperature.tC
			this.rgbTempFahrenheit = rgbData.temperature.tF
		}
	}

	parseIncomingData(data) {
		if (data.result != null) {
			this.parseRgbData(data.result['rgb:0'])
			for (let i = 0; i < this.lightCount; i++) {
				const lightKey = `light:${i}`
				const lightData = data.result[lightKey]

				if (lightData != null) {
					if (lightData.output !== undefined) {
						this.lightStates[i] = lightData.output
					}
					if (lightData.brightness !== undefined) {
						this.lightBrightness[i] = lightData.brightness
					}
					if (lightData.apower !== undefined) {
						this.lightPower[i] = lightData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.result[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.result[inputKey].state
				}
			}
		}
		if (data.method == 'NotifyStatus') {
			this.parseRgbData(data.params['rgb:0'])
			for (let i = 0; i < this.lightCount; i++) {
				const lightKey = `light:${i}`
				const lightData = data.params[lightKey]

				if (lightData != null) {
					if (lightData.output !== undefined) {
						this.lightStates[i] = lightData.output
					}
					if (lightData.brightness !== undefined) {
						this.lightBrightness[i] = lightData.brightness
					}
					if (lightData.apower !== undefined) {
						this.lightPower[i] = lightData.apower
					}
				}
			}
			for (let i = 0; i < this.inputCount; i++) {
				const inputKey = `input:${i}`
				if (data.params[inputKey]?.state !== undefined) {
					this.inputStates[i] = data.params[inputKey].state
				}
			}
		}
	}

	setRgbState(state) {
		this.sendRequest('RGB.Set', {
			id: 0,
			on: state == 0 ? true : false,
		})
	}

	setRgbColor(r, g, b) {
		this.sendRequest('RGB.Set', {
			id: 0,
			rgb: [r, g, b],
		})
	}

	setRgbBrightness(brightness) {
		this.sendRequest('RGB.Set', {
			id: 0,
			brightness: brightness,
		})
	}

	setLightState(lightId, state) {
		this.sendRequest('Light.Set', {
			id: lightId,
			on: state == 0 ? true : false,
		})
	}

	setLightBrightness(lightId, brightness) {
		this.sendRequest('Light.Set', {
			id: lightId,
			brightness: brightness,
		})
	}

	getVariableValues() {
		const variableValues = {}

		variableValues['rgb_state'] = this.rgbState
		variableValues['rgb_red'] = this.rgbColor[0]
		variableValues['rgb_green'] = this.rgbColor[1]
		variableValues['rgb_blue'] = this.rgbColor[2]
		variableValues['rgb_brightness'] = this.rgbBrightness
		variableValues['rgb_consumption'] = this.rgbPower
		variableValues['rgb_temp_c'] = this.rgbTempCelsius
		variableValues['rgb_temp_f'] = this.rgbTempFahrenheit

		for (let i = 0; i < this.lightCount; i++) {
			variableValues[`light_${i + 1}_state`] = this.lightStates[i]
			variableValues[`light_${i + 1}_brightness`] = this.lightBrightness[i]
			variableValues[`light_${i + 1}_consumption`] = this.lightPower[i]
		}

		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		variables.push({ name: 'RGB State', variableId: 'rgb_state' })
		variables.push({ name: 'RGB Red', variableId: 'rgb_red' })
		variables.push({ name: 'RGB Green', variableId: 'rgb_green' })
		variables.push({ name: 'RGB Blue', variableId: 'rgb_blue' })
		variables.push({ name: 'RGB Brightness', variableId: 'rgb_brightness' })
		variables.push({ name: 'RGB Power Consumption', variableId: 'rgb_consumption' })
		variables.push({ name: 'RGB Temperature (°C)', variableId: 'rgb_temp_c' })
		variables.push({ name: 'RGB Temperature (°F)', variableId: 'rgb_temp_f' })

		for (let i = 0; i < this.lightCount; i++) {
			variables.push({
				name: `Light ${i + 1} State`,
				variableId: `light_${i + 1}_state`,
			})
			variables.push({
				name: `Light ${i + 1} Brightness`,
				variableId: `light_${i + 1}_brightness`,
			})
			variables.push({
				name: `Light ${i + 1} Power Consumption`,
				variableId: `light_${i + 1}_consumption`,
			})
		}

		for (let i = 0; i < this.inputCount; i++) {
			variables.push({
				name: `Input ${i + 1} State`,
				variableId: `input_${i + 1}_state`,
			})
		}

		return variables
	}

	getFeedbackDefinitions() {
		const lightOptions = Array.from({ length: this.lightCount }, (_, index) => ({
			id: index,
			label: `Light ${index + 1}`,
		}))

		const inputOptions = Array.from({ length: this.inputCount }, (_, index) => ({
			id: index,
			label: `Input ${index + 1}`,
		}))

		return {
			rgbState: {
				type: 'boolean',
				name: 'RGB state',
				description: 'Get the on/off state of the RGB channel',
				options: [],
				callback: () => {
					return this.rgbState
				},
			},
			rgbColor: {
				type: 'advanced',
				name: 'RGB color',
				description: 'Displays the current RGB color as the button background color',
				options: [],
				callback: () => {
					const [r, g, b] = this.rgbColor
					return {
						bgcolor: ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0),
					}
				},
			},
			rgbBrightness: {
				type: 'advanced',
				name: 'RGB brightness',
				description: 'Displays the current RGB brightness',
				options: [],
				callback: () => {
					return { text: this.rgbBrightness + '%' }
				},
			},
			rgbPowerConsumption: {
				type: 'advanced',
				name: 'RGB power consumption',
				description: 'Displays the current power consumption of the RGB channel',
				options: [],
				callback: () => {
					return { text: this.rgbPower + ' W' }
				},
			},
			lightState: {
				type: 'boolean',
				name: 'Light state',
				description: 'Get the state of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return this.lightStates[feedback.options.selectedLight]
				},
			},
			lightBrightness: {
				type: 'advanced',
				name: 'Light brightness',
				description: 'Displays the current brightness of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.lightBrightness[feedback.options.selectedLight] + '%' }
				},
			},
			lightPowerConsumption: {
				type: 'advanced',
				name: 'Light power consumption',
				description: 'Displays the current power consumption of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: (feedback) => {
					return { text: this.lightPower[feedback.options.selectedLight] + ' W' }
				},
			},
			inputState: {
				type: 'boolean',
				name: 'Input state',
				description: 'Feedback on the Shelly inputs',
				options: [
					{
						type: 'dropdown',
						label: 'Input',
						id: 'selectedInput',
						default: 0,
						choices: inputOptions,
					},
				],
				callback: (feedback) => {
					return this.inputStates[feedback.options.selectedInput]
				},
			},
		}
	}

	getActionDefinitions() {
		const lightOptions = Array.from({ length: this.lightCount }, (_, index) => ({
			id: index,
			label: `Light ${index + 1}`,
		}))

		const stateOptions = [
			{ id: 0, label: 'On' },
			{ id: 1, label: 'Off' },
		]

		return {
			setRgbState: {
				name: 'RGB: Set state',
				description: 'Turn the RGB channel on or off',
				options: [
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setRgbState(action.options.selectedState)
				},
			},
			toggleRgbState: {
				name: 'RGB: Toggle state',
				description: 'Toggle the RGB channel on/off',
				options: [],
				callback: async () => {
					if (this.rgbState === undefined) {
						this.rgbState = false
					}
					const targetState = this.rgbState == true ? 1 : 0
					this.setRgbState(targetState)
				},
			},
			setRgbColor: {
				name: 'RGB: Set color',
				description: 'Set the RGB color',
				options: [
					{
						type: 'colorpicker',
						label: 'Color',
						id: 'selectedColor',
						default: 0xff0000,
						enableAlpha: false,
					},
				],
				callback: async (action) => {
					const color = action.options.selectedColor
					const r = (color >> 16) & 0xff
					const g = (color >> 8) & 0xff
					const b = color & 0xff
					this.setRgbColor(r, g, b)
				},
			},
			setRgbBrightness: {
				name: 'RGB: Set brightness',
				description: 'Set the brightness of the RGB channel',
				options: [
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setRgbBrightness(action.options.selectedBrightness)
				},
			},
			setLightState: {
				name: 'Light: Set state',
				description: 'Turn on/off a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
					{
						type: 'dropdown',
						label: 'State',
						id: 'selectedState',
						default: 0,
						choices: stateOptions,
					},
				],
				callback: async (action) => {
					this.setLightState(action.options.selectedLight, action.options.selectedState)
				},
			},
			toggleLight: {
				name: 'Light: Toggle state',
				description: 'Toggle a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
				],
				callback: async (action) => {
					if (this.lightStates[action.options.selectedLight] === undefined) {
						this.lightStates[action.options.selectedLight] = false
					}
					const targetState = this.lightStates[action.options.selectedLight] == true ? 1 : 0
					this.setLightState(action.options.selectedLight, targetState)
				},
			},
			setLightBrightness: {
				name: 'Light: Set brightness',
				description: 'Set the brightness of a light channel',
				options: [
					{
						type: 'dropdown',
						label: 'Light',
						id: 'selectedLight',
						default: 0,
						choices: lightOptions,
					},
					{
						type: 'number',
						label: 'Brightness (%)',
						id: 'selectedBrightness',
						default: 100,
						min: 0,
						max: 100,
					},
				],
				callback: async (action) => {
					this.setLightBrightness(action.options.selectedLight, action.options.selectedBrightness)
				},
			},
		}
	}
}

export {
	ShellyRelayMaster as ShellyMaster,
	ShellyRelayMasterPM as ShellyMasterPM,
	ShellyMasterCover,
	ShellyMasterInput,
	ShellyMasterRGBCCT,
	ShellyMasterLight,
	ShellyMasterCCT,
	ShellyMasterRGBLight,
}
