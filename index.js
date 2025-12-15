import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { ShellyMaster, ShellyMasterCover, ShellyMasterPM, ShellyMasterInput } from './shelly.js'
import { configFields } from './config.js'
import * as crypto from 'crypto'

class WebsocketInstance extends InstanceBase {
	isInitialized = false

	async init(config) {
		this.config = config
		this.keepAlive = true
		this.setupInstance()
		this.isInitialized = true
		this.initWebSocket()
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
		delete ShellyMaster.shellyInstance
		switch (this.config.shellyProduct) {
			case 0:
				ShellyMaster.shellyInstance = new ShellyMaster(1, 1)
				break
			case 1:
				ShellyMaster.shellyInstance = new ShellyMasterPM(1, 1)
				break
			case 2:
				ShellyMaster.shellyInstance = new ShellyMasterPM(2, 2)
				break
			case 3:
				ShellyMaster.shellyInstance = new ShellyMasterCover(1, 2)
				break
			case 4:
				ShellyMaster.shellyInstance = new ShellyMaster(1, 1)
				break
			case 5:
				ShellyMaster.shellyInstance = new ShellyMasterPM(1, 1)
				break
			case 6:
				ShellyMaster.shellyInstance = new ShellyMaster(2, 2)
				break
			case 7:
				ShellyMaster.shellyInstance = new ShellyMasterPM(2, 2)
				break
			case 8:
				ShellyMaster.shellyInstance = new ShellyMasterCover(1, 2)
				break
			case 9:
				ShellyMaster.shellyInstance = new ShellyMaster(3, 3)
				break
			case 10:
				ShellyMaster.shellyInstance = new ShellyMasterPM(4, 4)
				break
			case 11:
				ShellyMaster.shellyInstance = new ShellyMasterCover(2, 4)
				break
			case 12:
				ShellyMaster.shellyInstance = new ShellyMasterInput(4)
				break
		}
		this.initFeedbacks()
		this.initActions()
		this.initVariables()
	}

	async configUpdated(config) {
		this.config = config

		this.setupInstance()

		this.initWebSocket()
	}

	sendPing() {
		if (ShellyMaster.ws && ShellyMaster.ws.readyState === 1) {
			this.hasAnsweredPing = false
			ShellyMaster.ws.ping()
			this.pingTimeout = setTimeout(() => {
				if (!this.hasAnsweredPing) {
					this.updateStatus(InstanceStatus.Disconnected, 'Connection lost')
					if (this.pingInterval) {
						clearInterval(this.pingInterval)
						this.pingInterval = null
					}
					this.maybeReconnect() // Rufen Sie die maybeReconnect-Methode auf, wenn keine Pong empfangen wurde
				}
			}, 3000)
		}
	}

	initializePingPong() {
		this.pingInterval = setInterval(() => {
			this.sendPing()
		}, 3000)

		ShellyMaster.ws.on('pong', () => {
			this.hasAnsweredPing = true
		})
	}

	maybeReconnect() {
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
		if (this.pingInterval) {
			clearTimeout(this.pingInterval)
			this.pingInterval = null
		}
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		const url = 'ws://' + this.config.targetIp + '/rpc'
		if (!url || !this.config.targetIp) {
			this.updateStatus(InstanceStatus.BadConfig, `IP is missing`)
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		if (ShellyMaster.ws) {
			ShellyMaster.ws.close(1000)
			delete ShellyMaster.ws
		}
		ShellyMaster.auth = null
		ShellyMaster.ws = new WebSocket(url)

		ShellyMaster.ws.on('open', () => {
			this.updateStatus(InstanceStatus.Ok)
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.initializePingPong()
			ShellyMaster.ws.send(
				JSON.stringify({
					id: 1,
					src: 'user_1',
					method: 'Shelly.GetStatus',
				})
			)
		})
		ShellyMaster.ws.on('close', (code) => {
			this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			this.maybeReconnect()
		})

		ShellyMaster.ws.on('message', async (message) => {
			try {
				const data = JSON.parse(message)
				if (data.error?.code === 401) {
					console.log('Authentication required, attempting Digest Auth...')

					const { auth_type, nonce, realm } = JSON.parse(data.error.message)
					if (auth_type !== 'digest') return console.error('Unsupported authentication type')

					const cnonce = Math.floor(Math.random() * 10e8)
					const username = 'admin',
						password = this.config.password
					const ha1 = crypto.createHash('sha256').update([username, realm, password].join(':')).digest('hex')

					const response = crypto
						.createHash('sha256')
						.update(`${ha1}:${nonce}:1:${cnonce}:auth:6370ec69915103833b5222b368555393393f098bfbfbb59f47e0590af135f062`)
						.digest('hex')

					const auth = {
						realm,
						username,
						nonce,
						cnonce,
						response,
						algorithm: 'SHA-256',
					}

					ShellyMaster.auth = auth

					const messageToSend = {
						id: 1,
						src: 'user_1',
						method: 'Shelly.GetStatus',
						auth: auth,
					}

					setTimeout(() => {
						try {
							if (ShellyMaster.ws && ShellyMaster.ws.readyState === WebSocket.OPEN) {
								ShellyMaster.ws.send(JSON.stringify(messageToSend))
							}
						} catch (error) {
							console.error('Error sending auth message', error)
						}
					}, 1000)
				} else {
					this.messageReceivedFromWebSocket(message)
				}
			} catch (e) {
				console.error('Error processing WebSocket message', e)
			}
		})

		ShellyMaster.ws.on('error', (data) => {
			console.log('error', `WebSocket error: ${data}`)
			this.maybeReconnect()
		})
	}

	messageReceivedFromWebSocket(data) {
		let msgValue = null
		try {
			msgValue = JSON.parse(data)
		} catch {
			msgValue = data
		}
		if (msgValue != null) {
			ShellyMaster.shellyInstance.parseIncomingData(msgValue)
			this.checkFeedbacks()
			this.setVariableValues(ShellyMaster.shellyInstance.getVariableValues())
		}
	}

	getConfigFields() {
		return configFields
	}

	initFeedbacks() {
		this.setFeedbackDefinitions(ShellyMaster.shellyInstance.getFeedbackDefinitions())
	}

	initActions() {
		this.setActionDefinitions(ShellyMaster.shellyInstance.getActionDefinitions())
	}
	initVariables() {
		this.setVariableDefinitions(ShellyMaster.shellyInstance.getVariableDefinitions())
	}
}

runEntrypoint(WebsocketInstance, upgradeScripts)
