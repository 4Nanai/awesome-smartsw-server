# ASS (Awesome Smart Switch Server)
## How to run
1. clone repo
```shell
git clone git@github.com:4Nanai/awesome-smartsw-server.git && cd awesome-smartsw-server
```
2. install packages
```shell
npm install
```
3. copy env file
```shell
cp .env.example .env
```
4. start server
```shell
npm run dev
```

## Websocket Message Body
### Endpoint to Server
#### MESSAGE_TYPE
1. `device_auth`
- `uniqueHardwareId` must be provided
- `token` must be provided
```json
{
  "type": "device_auth",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "token": "Device binding token"
  }
}
```
2. `device_reconnect`

Used when endpoint device needs to reconnect to the server
- `uniqueHardwareId` must be provided
```json
{
  "type": "device_reconnect",
  "payload" : {
    "uniqueHardwareId": "Endpoint MAC address"
  }
}
```
3. `data_report`

Use to report all types of sensor data
- `type` must be provided
- `sensor` must be provided, and it should contain at least one or more sensor data object
  - `temp_humi`: temperature and humidity sensor data (degC, RH%, UTC epoch)
  - `pir`: PIR motion sensor data (present, UTC epoch)
  - `radar`: Radar motion sensor data (present, UTC epoch)
  - `sound`: Sound sensor data (UTC epoch of last detected sound)
```json
{
  "type": "data_report",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "sensor": {
      "temp_humi": {
        "temperature": 25.5,
        "humidity": 60,
        "ts": 1625247600
      },
      "pir": {
        "state": true,
        "ts": 1625247600
      },
      "radar": {
        "state": false,
        "ts": 1625247600
      },
      "sound": {
        "ts": 1625247600
      }
    }
  }
}
```
4. `endpoint_state`

Endpoint reports its current state
- `uniqueHardwareId` must be provided
- `state` must be provided
- `state` can be `on`, `off`, and `error`.
- `from` indicates the command source (`manual_or_user`, `presence_sensor`, `sound_sensor`, `timer`, `ml`)
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on",
    "from": "manual_or_user"
  }
}
```
5. `others` (Customized)

### Server to Endpoint
#### MESSAGE_TYPE
1. `auth_success`

Sent when device authentication is successful
- `config` contains device configuration parameters, see `set_config` message for details

After receiving this message, endpoint should send its current state using `endpoint_state` message immediately.
```json
{
  "type": "auth_success",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "config": {
      ... // See `set_config`
    }
  },
}
```
2. `set_endpoint_state`

Sent when user sends command to endpoint
- `uniqueHardwareId`, `type` and `state` must be provided
- `state` must be `boolean`
- `from` indicates the command source (`user` or `ml`)
```json
{
  "type": "set_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "state": true,
      "from": "ml",
    }
  }
}
```
3. `query_endpoint_state`

Sent when user queries endpoint state
- `uniqueHardwareId` is optional
- If not provided, server should return all endpoint states associated with the user
```json
{
  "type": "query_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address"
  }
}
```

4. `set_config`

Sent when user updates device configuration
- `uniqueHardwareId` must be provided
- `config` contains one or more device configuration parameters to be updated
  - `automation_mode` must be one of: `off`, `presence`, `sound`, `timer`, `ml`
    - `off`: Disable automation
    - `presence`: Triggered by human presence detection
    - `sound`: Triggered by sound detection
    - `timer`: Triggered by scheduled timer
    - `ml`: Triggered by machine learning model
  - `presence_mode` must be one of: `pir_only`, `radar_only`, `fusion_or`, `fusion_and`
    - `pir_only`: Use PIR sensor only
    - `radar_only`: Use radar sensor only
    - `fusion_or`: Trigger when either PIR or radar detects
    - `fusion_and`: Trigger when both PIR and radar detect simultaneously
  - `sensor_off_delay` must be an integer around [15, 300] seconds (default: 30)
  - `timer` contains scheduled timer settings for each day of the week (0-6, Sunday-Saturday)
    - Each day can have up to 20 timer entries
    - Each timer entry contains:
      - `h`: hour (0-23)
      - `m`: minute (0-59)
      - `s`: second (0-59)
      - `a`: action (true for turn on, false for turn off)
  - `mqtt_config` contains MQTT configuration parameters
    - `device_name`: MQTT device name
    - `broker_url`: MQTT broker URL
    - `port`: MQTT broker port
    - `topic_prefix`: MQTT topic prefix
    - `username`: (Optional) MQTT username
    - `password`: (Optional) MQTT password
    - `client_id`: (Optional) MQTT client ID
    - `ha_discovery_enabled`: (Optional) Home Assistant discovery enabled
    - `ha_discovery_prefix`: (Optional) Home Assistant discovery prefix
```json
{
  "type": "set_config",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "config": {
      "automation_mode": "presence",
      "presence_mode": "fusion_or",
      "sensor_off_delay": 30,
      "timer": {
        "0": [ // sunday
          {
            "h": 14,
            "m": 30,
            "s": 0,
            "a": true   // turn on
          },
          {
            "h": 22,
            "m": 0,
            "s": 0,
            "a": false  // turn off
          },
          ... // max 20 per day
        ],
        "1": [ // monday
            // Same structure as above
        ],
        // ...
      },
      "mqtt_config": {
        "device_name": "device123",
        "broker_url": "mqtt://broker.example.com",
        "port": 1883,
        "topic_prefix": "prefix123",
        "username": "user",
        "password": "pass",
        "client_id": "client123",
        "ha_discovery_enabled": false,
        "ha_discovery_prefix": "homeassistant"
      }
    }
  }
}
```

5. `device_unbound`
Sent when device sends `device_reconnect` but is not registered
```json
{
  "type": "device_unbound",
  "message": "Device not registered."
}
```

### User to Server
#### MESSAGE_TYPE
1. `user_auth`

Sent when user authenticates
- `token` must be provided
```json
{
  "type": "user_auth",
  "payload": {
    "token": "User jwt token"
  }
}
```

2. `set_endpoint_state`

Sent when user sends command to endpoint
- `uniqueHardwareId`, `type` and `state` must be provided
- `state` must be `boolean`
- `from` indicates the command source (`user` or `ml`)
```json
{
  "type": "set_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "state": true,
      "from": "user",
    }
  }
}
```

3. `query_endpoint_state`

Sent when user queries endpoint state
- `uniqueHardwareId` is optional
- If not provided, server should return all endpoint states associated with the user
```json
{
  "type": "query_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address(Optional)"
  }
}
```

### Server to User
#### MESSAGE_TYPE
1. `auth_success`

Sent when user authentication is successful
```json
{
    "type": "auth_success",
    "message": "User authentication successful."
}
```
2. `auth_failure`
```json
{
    "type": "auth_failure",
    "message": "Invalid or expired token."
}
```
3. `endpoint_state`

Sent when server returns endpoint state(s)
- `uniqueHardwareId` and `state` must be provided
- `state` can be `on`, `off`, `error`.
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on"
  }
}
```
