import { InstanceBase, runEntrypoint, InstanceStatus, combineRgb } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { ShellyMaster, ShellyMasterCover, ShellyMasterPM, ShellyMasterInput} from './shelly.js';
import { configFields } from './config.js'


class WebsocketInstance extends InstanceBase {
	isInitialized = false

	async init(config) {
		this.config = config

		this.setupInstance();
		this.initWebSocket()
		this.isInitialized = true
	}

	async destroy() {
		this.isInitialized = false
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}
		if (ShellyMaster.ws) {
			ShellyMaster.ws.close(1000)
			delete ShellyMaster.ws
		}
	}

	setupInstance() {
		delete ShellyMaster.shellyInstance;
		switch(this.config.shellyProduct) {
			case 0: ShellyMaster.shellyInstance = new ShellyMaster(1,1); break;
			case 1: ShellyMaster.shellyInstance = new ShellyMasterPM(1,1); break;
			case 2: ShellyMaster.shellyInstance = new ShellyMasterPM(2,2); break;
			case 3: ShellyMaster.shellyInstance = new ShellyMasterCover(1,2); break;
			case 4: ShellyMaster.shellyInstance = new ShellyMaster(1,1); break;
			case 5: ShellyMaster.shellyInstance = new ShellyMasterPM(1,1); break;
			case 6: ShellyMaster.shellyInstance = new ShellyMaster(2,2); break;
			case 7: ShellyMaster.shellyInstance = new ShellyMasterPM(2,2); break;
			case 8: ShellyMaster.shellyInstance = new ShellyMasterCover(1,2); break;
			case 9: ShellyMaster.shellyInstance = new ShellyMaster(3,3); break;
			case 10: ShellyMaster.shellyInstance = new ShellyMasterPM(4,4); break;
			case 11: ShellyMaster.shellyInstance = new ShellyMasterCover(2,4); break;
			case 12: ShellyMaster.shellyInstance = new ShellyMasterInput(4); break;
		}
		this.initFeedbacks();
		this.initActions();
	}

	async configUpdated(config) {
		this.config = config

		this.setupInstance();

		this.initWebSocket();
	}

	maybeReconnect() {
		console.log("Maybe Reconnect")
		if (this.isInitialized && this.config.reconnect) {
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.reconnect_timer = setTimeout(() => {
				this.initWebSocket()
			}, 5000)
		}
	}

	initWebSocket() {
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		const url = "ws://" + this.config.targetIp + "/rpc"
		if (!url || !this.config.targetIp) {
			this.updateStatus(InstanceStatus.BadConfig, `IP is missing`)
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		if (ShellyMaster.ws) {
			console.log("init websocket")
			ShellyMaster.ws.close(1000)
			delete ShellyMaster.ws
		}
		ShellyMaster.ws = new WebSocket(url)

		ShellyMaster.ws.on('open', () => {
			this.updateStatus(InstanceStatus.Ok);
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			ShellyMaster.ws.send(
				JSON.stringify(
					{
						id: 1,
						src: "user_1",
						method: "Shelly.GetStatus"
					}
				)
			)
		})
		ShellyMaster.ws.on('close', (code) => {
			this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			this.maybeReconnect()
		})

		ShellyMaster.ws.on('message', this.messageReceivedFromWebSocket.bind(this))

		ShellyMaster.ws.on('error', (data) => {
			console.log('error', `WebSocket error: ${data}`)
			this.maybeReconnect();
		})
	}


	messageReceivedFromWebSocket(data) {
		let msgValue = null
		try {
			msgValue = JSON.parse(data)
		} catch (e) {
			msgValue = data
		}
		if(msgValue != null) {
			ShellyMaster.shellyInstance.parseIncomingData(msgValue);
			this.checkFeedbacks();
		}
	}

	getConfigFields() {
		return configFields;
	}

	initFeedbacks() {
		this.setFeedbackDefinitions(ShellyMaster.shellyInstance.getFeedbackDefinitions());
	}

	initActions() {
		this.setActionDefinitions(ShellyMaster.shellyInstance.getActionDefinitions());
	}
}

runEntrypoint(WebsocketInstance, upgradeScripts)
