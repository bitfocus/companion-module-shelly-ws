import {Regex} from '@companion-module/base'


export const configFields = [
	{
		type: 'textinput',
		id: 'targetIp',
		label: 'Target IP',
		width: 6,
		regex: Regex.IP,
	},
	{
		type: 'checkbox',
		id: 'reconnect',
		label: 'Reconnect',
		tooltip: 'Reconnect on WebSocket error (after 5 secs)',
		width: 6,
		default: true,
	},
	{
		type: 'static-text',
		id: 'info',
		width: 12,
		value: 'Please select the correct Shelly product from the dropdown menu, ' +
		 		'before setting up any buttons - this is because the different products ' + 
				'have different actions and feedbacks. <br> <i>Changing the product after ' + 
				'buttons have been setup can break things!</i>'
	},
	{
		type: 'dropdown',
		id: 'shellyProduct',
		label: 'Shelly Product',
		width: 6,
		default: 0,
		choices: [
			{ id: 0, label: 'Shelly Plus 1' },
			{ id: 1, label: 'Shelly Plus 1PM' },
			{ id: 2, label: 'Shelly Plus 2PM Relay Mode' },
			{ id: 3, label: 'Shelly Plus 2PM Roller Mode' },
			{ id: 4, label: 'Shelly Pro 1' },
			{ id: 5, label: 'Shelly Pro 1PM' },
			{ id: 6, label: 'Shelly Pro 2' },
			{ id: 7, label: 'Shelly Pro 2PM Relay Mode' },
			{ id: 8, label: 'Shelly Pro 2PM Roller Mode' },
			{ id: 9, label: 'Shelly Pro 3' },
			{ id: 10, label: 'Shelly Pro 4PM' },
		],
	},
]
