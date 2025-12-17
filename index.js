import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { ShellyMaster, ShellyMasterCover, ShellyMasterPM, ShellyMasterInput } from './shelly.js'
import { configFields } from './config.js'
import * as crypto from 'crypto'

class WebsocketInstance extends InstanceBase {
	isInitialized = false
	ws = null
	auth = null
	shelly = null
	authAttempted = false
	authSuccess = false
	heartbeatInterval = null
	requestId = 1

	async init(config) {
		this.isInitialized = true
		this.config = config
		this.setupInstance()
		this.initWebSocket()
	}

	async destroy() {
		this.isInitialized = false
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
		}
		if (this.ws) {
			this.ws.removeAllListeners()
			// Add error handler to prevent unhandled errors during close
			this.ws.on('error', () => {
				// Ignore errors during shutdown
			})
			try {
				// Only close if the connection is open or connecting
				if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
					this.ws.close(1000)
				}
			} catch {
				// Ignore errors during shutdown
			}
			this.ws = null
		}
	}

	setupInstance() {
		const sendRequest = (method, params) => {
			this.sendShellyRequest(method, params)
		}

		switch (this.config.shellyProduct) {
			case 0:
				this.shelly = new ShellyMaster(1, 1, sendRequest)
				break
			case 1:
				this.shelly = new ShellyMasterPM(1, 1, sendRequest)
				break
			case 2:
				this.shelly = new ShellyMasterPM(2, 2, sendRequest)
				break
			case 3:
				this.shelly = new ShellyMasterCover(1, 2, sendRequest)
				break
			case 4:
				this.shelly = new ShellyMaster(1, 1, sendRequest)
				break
			case 5:
				this.shelly = new ShellyMasterPM(1, 1, sendRequest)
				break
			case 6:
				this.shelly = new ShellyMaster(2, 2, sendRequest)
				break
			case 7:
				this.shelly = new ShellyMasterPM(2, 2, sendRequest)
				break
			case 8:
				this.shelly = new ShellyMasterCover(1, 2, sendRequest)
				break
			case 9:
				this.shelly = new ShellyMaster(3, 3, sendRequest)
				break
			case 10:
				this.shelly = new ShellyMasterPM(4, 4, sendRequest)
				break
			case 11:
				this.shelly = new ShellyMasterCover(2, 4, sendRequest)
				break
			case 12:
				this.shelly = new ShellyMasterInput(4, sendRequest)
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
		if (this.ws && this.ws.readyState === 1) {
			this.hasAnsweredPing = false
			this.ws.ping()
			this.pingTimeout = setTimeout(() => {
				if (!this.hasAnsweredPing) {
					this.updateStatus(InstanceStatus.Disconnected, 'Connection lost')
					if (this.heartbeatInterval) {
						clearInterval(this.heartbeatInterval)
						this.heartbeatInterval = null
					}
					this.maybeReconnect()
				}
			}, 3000)
		}
	}

	startHeartbeat() {
		let ticks = 0
		this.heartbeatInterval = setInterval(() => {
			ticks++
			if (ticks >= 20) {
				// 60 seconds
				this.sendShellyRequest('Shelly.GetStatus')
				ticks = 0
			}
			this.sendPing()
		}, 3000)

		this.ws.on('pong', () => {
			this.hasAnsweredPing = true
			if (this.pingTimeout) {
				clearTimeout(this.pingTimeout)
				this.pingTimeout = null
			}
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
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
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
		if (this.ws) {
			this.ws.removeAllListeners()
			this.ws.close(1000)
			this.ws = null
		}
		this.auth = null
		this.authAttempted = false
		this.authSuccess = false
		this.ws = new WebSocket(url)

		this.ws.on('open', () => {
			if (this.reconnect_timer) {
				clearTimeout(this.reconnect_timer)
			}
			this.updateStatus(InstanceStatus.Ok)
			this.startHeartbeat()
			this.sendShellyRequest('Shelly.GetStatus')
		})
		this.ws.on('close', (code) => {
			this.updateStatus(InstanceStatus.Disconnected, `Connection closed with code ${code}`)
			this.maybeReconnect()
		})

		this.ws.on('message', async (message) => {
			try {
				const data = JSON.parse(message)
				if (data.error?.code === 401) {
					// If we've already tried authentication, the password is wrong
					if (this.authAttempted) {
						if (this.authSuccess) {
							this.authAttempted = false
							this.authSuccess = false
							this.log('debug', 'Authentication expired, retrying')
						} else {
							this.updateStatus(InstanceStatus.ConnectionFailure, 'Authentication failed')
							return
						}
					}

					this.authAttempted = true
					this.updateStatus(InstanceStatus.Connecting, 'Authenticating')

					const { auth_type, nonce, realm } = JSON.parse(data.error.message)
					if (auth_type !== 'digest') {
						this.updateStatus(InstanceStatus.ConnectionFailure, 'Unsupported authentication type')
						return
					}

					const cnonce = Math.floor(Math.random() * 10e8)
					const username = 'admin',
						password = this.config.password
					const ha1 = crypto.createHash('sha256').update([username, realm, password].join(':')).digest('hex')

					const response = crypto
						.createHash('sha256')
						.update(`${ha1}:${nonce}:1:${cnonce}:auth:6370ec69915103833b5222b368555393393f098bfbfbb59f47e0590af135f062`)
						.digest('hex')

					this.auth = {
						realm,
						username,
						nonce,
						cnonce,
						response,
						algorithm: 'SHA-256',
					}

					try {
						if (this.ws && this.ws.readyState === WebSocket.OPEN) {
							this.sendShellyRequest('Shelly.GetStatus')
						}
					} catch (error) {
						this.log('warn', `Error sending auth message: ${error}`)
					}
				} else {
					this.messageReceivedFromWebSocket(data)
				}
			} catch (e) {
				this.log('warn', `Error processing WebSocket message: ${e}`)
			}
		})

		this.ws.on('error', (data) => {
			this.log('warn', `WebSocket error: ${data}`)
			this.maybeReconnect()
		})
	}

	sendShellyRequest(method, params) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const request = {
				id: this.requestId++,
				src: 'user_1',
				method: method,
			}

			// Only include params if provided
			if (params !== undefined) {
				request.params = params
			}

			// Only include auth if we have it
			if (this.auth) {
				request.auth = this.auth
			}

			this.ws.send(JSON.stringify(request))
		}
	}

	messageReceivedFromWebSocket(data) {
		let msgValue = data
		if (msgValue != null) {
			if (msgValue.result !== undefined || msgValue.method !== undefined) {
				if (this.authSuccess === false) {
					this.updateStatus(InstanceStatus.Ok)
				}
				this.authSuccess = true
			}
			this.shelly.parseIncomingData(msgValue)
			const variables = this.shelly.getVariableValues()
			this.checkFeedbacks()
			this.setVariableValues(variables)
		}
	}

	getConfigFields() {
		return configFields
	}

	initFeedbacks() {
		this.setFeedbackDefinitions(this.shelly.getFeedbackDefinitions())
	}

	initActions() {
		this.setActionDefinitions(this.shelly.getActionDefinitions())
	}
	initVariables() {
		const defs = this.shelly.getVariableDefinitions()
		this.setVariableDefinitions(defs)
	}
}

runEntrypoint(WebsocketInstance, upgradeScripts)
