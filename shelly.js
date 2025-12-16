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

		// Relay states
		for (let i = 0; i < this.inputCount; i++) {
			variableValues[`input_${i + 1}_state`] = this.inputStates[i] != undefined ? this.inputStates[i] : false
		}

		return variableValues
	}

	getVariableDefinitions() {
		const variables = []

		// Relay States
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

export {
	ShellyRelayMaster as ShellyMaster,
	ShellyRelayMasterPM as ShellyMasterPM,
	ShellyMasterCover,
	ShellyMasterInput,
}
